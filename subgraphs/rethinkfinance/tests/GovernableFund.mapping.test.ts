import {
  assert,
  clearStore,
  newMockCall,
  test,
  describe,
  afterAll,
} from "matchstick-as/assembly/index"
import { Address, BigInt, Bytes, ByteArray, crypto, ethereum } from "@graphprotocol/graph-ts"

// AssemblyScript intrinsic: provide a declaration so TypeScript tooling doesn't error (TS2304)
// The AS compiler provides changetype at compile-time.
declare function changetype<T>(value: unknown): T

import { handleFundFlowsCall } from "../mappings/GovernableFund.mapping"
import { FundFlowsCallCall } from "../generated/templates/GovernableFund/GovernableFund"

// Helpers
function selectorFor(signature: string): Bytes {
  const hash = crypto.keccak256(ByteArray.fromUTF8(signature))
  const sel = hash.subarray(0, 4)
  return Bytes.fromUint8Array(sel)
}

function toHex(bytes: Bytes): string {
  let out = "0x"
  for (let i = 0; i < bytes.length; i++) {
    const h = bytes[i].toString(16)
    out += h.length == 1 ? "0" + h : h
  }
  return out
}


function mockCallWithFlow(flowCall: Bytes, from: Address, to: Address, blockNum: number, timestamp: number, txHashHex: string): FundFlowsCallCall {
  const call = newMockCall()
  call.to = to
  call.from = from
  // newMockCall() already initializes block & transaction; just mutate fields
  call.block.number = BigInt.fromI32(blockNum)
  call.block.timestamp = BigInt.fromI32(timestamp)
  call.transaction.hash = Bytes.fromHexString(txHashHex) as Bytes
  call.inputValues = [
    new ethereum.EventParam("flowCall", ethereum.Value.fromBytes(flowCall)),
  ]
  return changetype<FundFlowsCallCall>(call)
}

function expectedId(txHashHex: string, blockNum: number, flowCall: Bytes): string {
  const sel = Bytes.fromUint8Array(flowCall.slice(0, 4))
  return txHashHex.toLowerCase() + ":" + BigInt.fromI32(blockNum).toString() + ":" + toHex(sel)
}

const FROM = Address.fromString("0x00000000000000000000000000000000000000f0")
const TO = Address.fromString("0x00000000000000000000000000000000000000a0")
const TX = "0x1111111111111111111111111111111111111111111111111111111111111111"

describe("handleFundFlowsCall basics", () => {
  afterAll(() => {
    clearStore()
  })
	//
  // test("deposit() no params", () => {
  //   clearStore()
  //   const sig = "deposit()"
  //   const flow = buildFlowCall(sig, [], [])
  //   const call = mockCallWithFlow(flow, FROM, TO, 90, 900, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 90, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  // })
	//
  // test("withdraw() no params", () => {
  //   clearStore()
  //   const sig = "withdraw()"
  //   const flow = buildFlowCall(sig, [], [])
  //   const call = mockCallWithFlow(flow, FROM, TO, 91, 901, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 91, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  // })
	//
  // test("sweepTokens() no params", () => {
  //   clearStore()
  //   const sig = "sweepTokens()"
  //   const flow = buildFlowCall(sig, [], [])
  //   const call = mockCallWithFlow(flow, FROM, TO, 92, 902, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 92, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  // })
	//
  // test("requestDeposit(uint256) decodes amount", () => {
  //   clearStore()
  //   const sig = "requestDeposit(uint256)"
  //   const amount = BigInt.fromString("123456789000000000000")
  //   const flow = buildFlowCall(sig, ["uint256"], [ethereum.Value.fromUnsignedBigInt(amount)])
  //   const call = mockCallWithFlow(flow, FROM, TO, 100, 1000, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 100, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "amount", amount.toString())
  //   assert.fieldEquals("FundFlow", id, "selectorHex", toHex(Bytes.fromUint8Array(flow.slice(0, 4))))
  // })
	//
  // test("requestWithdraw(uint256) decodes amount", () => {
  //   clearStore()
  //   const sig = "requestWithdraw(uint256)"
  //   const amount = BigInt.fromI32(999)
  //   const flow = buildFlowCall(sig, ["uint256"], [ethereum.Value.fromUnsignedBigInt(amount)])
  //   const call = mockCallWithFlow(flow, FROM, TO, 100, 1000, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 100, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "amount", amount.toString())
  // })
	//
  // test("collectFees(uint8) decodes feeKind", () => {
  //   clearStore()
  //   const sig = "collectFees(uint8)"
  //   const feeKind: number = 2
  //   const flow = buildFlowCall(sig, ["uint8"], [ethereum.Value.fromI32(feeKind)])
  //   const call = mockCallWithFlow(flow, FROM, TO, 101, 1001, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 101, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "feeKind", feeKind.toString())
  // })
	//
  // test("revokeDepositWithrawal(bool) decodes flag", () => {
  //   clearStore()
  //   const sig = "revokeDepositWithrawal(bool)"
  //   const flow = buildFlowCall(sig, ["bool"], [ethereum.Value.fromBoolean(true)])
  //   const call = mockCallWithFlow(flow, FROM, TO, 101, 1001, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 101, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "flag", "true")
  // })
	//
  // test("depositAndDelegateBySig decodes account and amounts", () => {
  //   clearStore()
  //   const sig = "depositAndDelegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)"
  //   const acct = Address.fromString("0x0000000000000000000000000000000000000abc")
  //   const amt1 = BigInt.fromI32(42)
  //   const amt2 = BigInt.fromI32(7)
  //   const v = 27
  //   const r = Bytes.fromHexString(
  //     "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  //   ) as Bytes
  //   const s = Bytes.fromHexString(
  //     "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  //   ) as Bytes
	//
  //   const flow = buildFlowCall(
  //     sig,
  //     ["address", "uint256", "uint256", "uint8", "bytes32", "bytes32"],
  //     [
  //       ethereum.Value.fromAddress(acct),
  //       ethereum.Value.fromUnsignedBigInt(amt1),
  //       ethereum.Value.fromUnsignedBigInt(amt2),
  //       ethereum.Value.fromI32(v),
  //       ethereum.Value.fromFixedBytes(r),
  //       ethereum.Value.fromFixedBytes(s),
  //     ],
  //   )
  //   const call = mockCallWithFlow(flow, FROM, TO, 102, 1002, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 102, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   // account is stored as Account relationship; ensure it exists and matches
  //   const acctId = acct.toHexString().toLowerCase()
  //   assert.fieldEquals("FundFlow", id, "account", acctId)
  //   assert.fieldEquals("FundFlow", id, "amount", amt1.toString())
  //   assert.fieldEquals("FundFlow", id, "amount2", amt2.toString())
  // })

  // test("mintPerformanceFee(uint256) decodes amount", () => {
  //   clearStore()
  //   const sig = "mintPerformanceFee(uint256)"
  //   const amount = BigInt.fromString("123456789")
  //   const flow = buildFlowCall(sig, ["uint256"], [ethereum.Value.fromUnsignedBigInt(amount)])
  //   const call = mockCallWithFlow(flow, FROM, TO, 104, 1004, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 104, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "amount", amount.toString())
  // })

  // test("mintToMany stores summary fields", () => {
  //   clearStore()
  //   const sig = "mintToMany(uint256[],address[])"
  //   const amts: Array<BigInt> = [BigInt.fromI32(1), BigInt.fromI32(2), BigInt.fromI32(3)]
  //   const addrs: Array<Address> = [
  //     Address.fromString("0x00000000000000000000000000000000000000b1"),
  //     Address.fromString("0x00000000000000000000000000000000000000b2"),
  //   ]
	//
  //   const flow = buildFlowCall(
  //     sig,
  //     ["uint256[]", "address[]"],
  //     [
  //       ethereum.Value.fromUnsignedBigIntArray(amts),
  //       ethereum.Value.fromAddressArray(addrs),
  //     ],
  //   )
  //   const call = mockCallWithFlow(flow, FROM, TO, 103, 1003, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 103, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "amount", amts[0].toString())
  //   assert.fieldEquals("FundFlow", id, "amount2", amts[1].toString())
  //   assert.fieldEquals("FundFlow", id, "account", addrs[0].toHexString().toLowerCase())
  // })
	//
  // test("mintPoolPerformanceFeeHWM(address) decodes account", () => {
  //   clearStore()
  //   const sig = "mintPoolPerformanceFeeHWM(address)"
  //   const acct = Address.fromString("0x00000000000000000000000000000000000000c1")
  //   const flow = buildFlowCall(sig, ["address"], [ethereum.Value.fromAddress(acct)])
  //   const call = mockCallWithFlow(flow, FROM, TO, 105, 1005, TX)
	//
  //   handleFundFlowsCall(call)
	//
  //   const id = expectedId(TX, 105, flow)
  //   assert.fieldEquals("FundFlow", id, "name", sig)
  //   assert.fieldEquals("FundFlow", id, "account", acct.toHexString().toLowerCase())
  // })

  test("arb1 calldata smoke test using real inner flowCall selector", () => {
    clearStore()
    // Provided outer calldata encodes fundFlowsCall(bytes) with a 4-byte payload: 0x3ccfd60b
    const innerSelector = Bytes.fromHexString("0x3ccfd60b") as Bytes

    // Use provided from/to/tx; fake block/timestamp
    const from = Address.fromString("0x299cCCdc650aC164b316984dF994641099ABcC09")
    const to = Address.fromString("0x58BA86cF363De2Bdbe57ad885B47F1B985EA9F31")
    const tx = "0x1ba82683a729b402fe781adeb86f7beac8e4313782e8acb2527d40ad715c0d28"
    const blockNum = 123456
    const timestamp = 1712345678

    const call = mockCallWithFlow(innerSelector, from, to, blockNum, timestamp, tx)

    handleFundFlowsCall(call)

    const id = expectedId(tx, blockNum, innerSelector)

    // Verify selectorHex is exactly the 4-byte inner selector
    assert.fieldEquals("FundFlow", id, "selectorHex", toHex(innerSelector))

    // Determine expected name from known no-arg signatures at runtime
    const sigs: Array<string> = [
      "deposit()",
      "withdraw()",
      "sweepTokens()",
    ]
    let expectedName = "unknown"
    for (let i = 0; i < sigs.length; i++) {
      if (toHex(Bytes.fromUint8Array(selectorFor(sigs[i]).slice(0, 4))) == toHex(innerSelector)) {
        expectedName = sigs[i]
        break
      }
    }

    assert.fieldEquals("FundFlow", id, "name", expectedName)
  })
})
