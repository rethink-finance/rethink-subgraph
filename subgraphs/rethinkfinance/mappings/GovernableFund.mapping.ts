import { Address, BigInt, Bytes, ByteArray, crypto, ethereum } from "@graphprotocol/graph-ts"
import { FundFlow, Transaction } from "../generated/schema"
import {
  FundFlowsCallCall,
  Transfer as FundTokenTransfer,
} from "../generated/templates/GovernableFund/GovernableFund"
import { fetchAccount } from "../utils/Account.util"

// Helper to compute 4-byte selector from signature at runtime
function selectorFor(signature: string): Bytes {
  const hash = crypto.keccak256(ByteArray.fromUTF8(signature))
  const sel = hash.subarray(0, 4)
  return Bytes.fromUint8Array(sel)
}

function bytesEq(a: Bytes, b: Bytes): boolean {
  if (a.length != b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (a[i] != b[i]) return false
  }
  return true
}

function toHex(bytes: Bytes): string {
  let out = "0x"
  for (let i = 0; i < bytes.length; i++) {
    const hex = bytes[i].toString(16)
    out += hex.length == 1 ? "0" + hex : hex
  }
  return out
}

// Call-handler path: exact, catches contract-mediated calls too, but requires
// the indexer's RPC to support trace_filter — only manifests for chains that
// have it (mainnet, base) may reference this handler.
export function handleFundFlowsCall(call: FundFlowsCallCall): void {
  saveFundFlow(
    call.to,
    call.from,
    call.transaction.from,
    call.inputs.flowCall,
    call.transaction.hash,
    call.block,
  )
}

// Event-handler path for chains whose RPCs lack trace_filter (Arbitrum,
// Polygon, HyperEVM), where call handlers freeze the subgraph. A flow call
// that moves value emits a share-token Transfer (mint = deposit / fee,
// burn = withdrawal), and when the fund was called directly the original
// fundFlowsCall calldata is still reachable through the transaction input —
// which is what every flow the dApp produces looks like. Not covered here:
// pure-storage calls that emit nothing (requestDeposit, requestWithdraw,
// revokeDepositWithrawal) and calls routed through another contract.
export function handleFundTokenTransfer(event: FundTokenTransfer): void {
  const zero = Address.zero()
  const isMint = bytesEq(event.params.from, zero)
  const isBurn = bytesEq(event.params.to, zero)
  if (!isMint && !isBurn) return // plain share transfers are not flows

  const txTo = event.transaction.to
  if (txTo === null) return
  if (!bytesEq(txTo as Address, event.address)) return // calldata belongs to another contract

  const input = event.transaction.input
  if (input.length < 4) return
  const outerSel = Bytes.fromUint8Array(input.slice(0, 4))
  if (!bytesEq(outerSel, selectorFor("fundFlowsCall(bytes)"))) return

  // Strip the outer selector and decode the single `bytes flowCall` argument.
  const dec = ethereum.decode("bytes", Bytes.fromUint8Array(input.slice(4)))
  if (dec == null) return

  saveFundFlow(
    event.address,
    event.transaction.from,
    event.transaction.from,
    dec!.toBytes(),
    event.transaction.hash,
    event.block,
  )
}

function saveFundFlow(
  fundAddress: Address,
  callerAddress: Address,
  txFromAddress: Address,
  raw: Bytes,
  txHash: Bytes,
  block: ethereum.Block,
): void {
  if (raw.length < 4) return
  const sel = Bytes.fromUint8Array(raw.slice(0, 4))
  const data = Bytes.fromUint8Array(raw.slice(4))

  const id = txHash.toHex() + ":" + block.number.toString() + ":" + toHex(sel)
  // FundFlow is immutable, and a single tx can reach this more than once
  // (mintToMany emits one Transfer per recipient) — only the first write may
  // happen.
  if (FundFlow.load(id) != null) return

  const caller = fetchAccount(callerAddress)

  // Known signatures
  const SIG_REVOKE = selectorFor("revokeDepositWithrawal(bool)")
  const SIG_REQ_DEP = selectorFor("requestDeposit(uint256)")
  const SIG_DEP = selectorFor("deposit()")
  const SIG_REQ_WD = selectorFor("requestWithdraw(uint256)")
  const SIG_WD = selectorFor("withdraw()")
  const SIG_SWEEP = selectorFor("sweepTokens()")
  const SIG_COLLECT_FEES = selectorFor("collectFees(uint8)")
  const SIG_DEPOSIT_DELEGATE_SIG = selectorFor(
    "depositAndDelegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)",
  )
  const SIG_MINT_PERF = selectorFor("mintPerformanceFee(uint256)")
  const SIG_MINT_TO_MANY = selectorFor("mintToMany(uint256[],address[])")
  const SIG_MINT_POOL_HWM = selectorFor("mintPoolPerformanceFeeHWM(address)")

  let name = "unknown"
  // Avoid nullable boolean; AS treats null as usize → bool cast error (AS200).
  // Use a presence flag plus a concrete boolean value.
  let hasFlag: boolean = false
  let flag: boolean = false
  let amount: BigInt | null = null
  let amount2: BigInt | null = null
  // Use BigInt instead of AS primitives for integers
  let feeKind: BigInt | null = null
  let account: Address | null = null

  if (bytesEq(sel, SIG_REVOKE)) {
    name = "revokeDepositWithrawal(bool)"
    const dec = ethereum.decode("bool", data)
    if (dec != null) {
      flag = dec!.toBoolean()
      hasFlag = true
    }
  } else if (bytesEq(sel, SIG_REQ_DEP)) {
    name = "requestDeposit(uint256)"
    const dec = ethereum.decode("uint256", data)
    if (dec != null) amount = dec!.toBigInt()
  } else if (bytesEq(sel, SIG_DEP)) {
    name = "deposit()"
  } else if (bytesEq(sel, SIG_REQ_WD)) {
    name = "requestWithdraw(uint256)"
    const dec = ethereum.decode("uint256", data)
    if (dec != null) amount = dec!.toBigInt()
  } else if (bytesEq(sel, SIG_WD)) {
    name = "withdraw()"
  } else if (bytesEq(sel, SIG_SWEEP)) {
    name = "sweepTokens()"
  } else if (bytesEq(sel, SIG_COLLECT_FEES)) {
    name = "collectFees(uint8)"
    // Decode as uint256 to get a BigInt directly and avoid AS i32 primitives
    const dec = ethereum.decode("uint256", data)
    if (dec != null) feeKind = dec!.toBigInt()
  } else if (bytesEq(sel, SIG_DEPOSIT_DELEGATE_SIG)) {
    name = "depositAndDelegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)"
    const dec = ethereum.decode(
      "(address,uint256,uint256,uint8,bytes32,bytes32)",
      data,
    )
    if (dec != null) {
      const tup = dec!.toTuple()
      account = tup[0].toAddress()
      amount = tup[1].toBigInt()
      amount2 = tup[2].toBigInt()
      // v (u8), r, s are ignored for indexing summary
    }
  } else if (bytesEq(sel, SIG_MINT_PERF)) {
    name = "mintPerformanceFee(uint256)"
    const dec = ethereum.decode("uint256", data)
    if (dec != null) amount = dec!.toBigInt()
  } else if (bytesEq(sel, SIG_MINT_TO_MANY)) {
    name = "mintToMany(uint256[],address[])"
    // store only the first values as summary (full arrays could be large)
    const dec = ethereum.decode("(uint256[],address[])", data)
    if (dec != null) {
      const tup = dec!.toTuple()
      const amounts = tup[0].toBigIntArray()
      const addrs = tup[1].toAddressArray()
      if (amounts.length > 0) amount = amounts[0]
      if (amounts.length > 1) amount2 = amounts[1]
      if (addrs.length > 0) account = addrs[0]
    }
  } else if (bytesEq(sel, SIG_MINT_POOL_HWM)) {
    name = "mintPoolPerformanceFeeHWM(address)"
    const dec = ethereum.decode("address", data)
    if (dec != null) account = dec!.toAddress()
  }

  const flow = new FundFlow(id)
  flow.fund = fundAddress
  // transactions.log expects an Event, but this handler receives a Call.
  // Create/ensure a Transaction entity from the call context.
  const txId = txHash.toHex()
  let tx = Transaction.load(txId)
  if (tx == null) {
    tx = new Transaction(txId)
    tx.timestamp = block.timestamp
    tx.blockNumber = block.number
    tx.save()
  }
  flow.transaction = txId
  flow.timestamp = block.timestamp
  flow.blockNumber = block.number
  flow.caller = caller.id
  flow.txFrom = fetchAccount(txFromAddress).id
  flow.raw = raw
  flow.selector = sel
  flow.selectorHex = toHex(sel)
  flow.name = name
  if (hasFlag) flow.flag = flag
  if (amount !== null) flow.amount = amount as BigInt
  if (amount2 !== null) flow.amount2 = amount2 as BigInt
  if (feeKind !== null) flow.feeKind = feeKind as BigInt
  if (account !== null) flow.account = fetchAccount(account as Address).id
  flow.save()
}
