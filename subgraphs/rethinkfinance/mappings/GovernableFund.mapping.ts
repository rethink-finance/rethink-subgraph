import { Address, BigInt, Bytes, ByteArray, crypto, ethereum } from "@graphprotocol/graph-ts"
import { FundFlow, Transaction } from "../generated/schema"
import { FundFlowsCallCall } from "../generated/templates/GovernableFund/GovernableFund"
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

export function handleFundFlowsCall(call: FundFlowsCallCall): void {
  const fundAddress = call.to
  const caller = fetchAccount(call.from)

  const raw: Bytes = call.inputs.flowCall
  if (raw.length < 4) return
  const sel = Bytes.fromUint8Array(raw.slice(0, 4))
  const data = Bytes.fromUint8Array(raw.slice(4))

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

  const id = call.transaction.hash.toHex() +
    ":" + call.block.number.toString() +
    ":" + toHex(sel)
  const flow = new FundFlow(id)
  flow.fund = fundAddress
  // transactions.log expects an Event, but this handler receives a Call.
  // Create/ensure a Transaction entity from the call context.
  const txId = call.transaction.hash.toHex()
  let tx = Transaction.load(txId)
  if (tx == null) {
    tx = new Transaction(txId)
    tx.timestamp = call.block.timestamp
    tx.blockNumber = call.block.number
    tx.save()
  }
  flow.transaction = txId
  flow.timestamp = call.block.timestamp
  flow.blockNumber = call.block.number
  flow.caller = caller.id
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
