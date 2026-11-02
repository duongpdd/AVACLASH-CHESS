import { expect, it } from "vitest";
import { encodeAbiParameters, keccak256 } from "viem";
import { parseRewardClaim } from "../utils/reward-claims";
const address = "0x1111111111111111111111111111111111111111";
const meta = "0x2222222222222222222222222222222222222222";
function file() {
  return {
    chainId: 31337,
    metaAddress: meta,
    seasonId: "0",
    allocationHash: `0x${"33".repeat(32)}`,
    merkleRoot: keccak256(
      keccak256(
        encodeAbiParameters(
          [
            { type: "uint256" },
            { type: "address" },
            { type: "uint256" },
            { type: "address" },
            { type: "uint256" },
          ],
          [31337n, meta, 0n, address, 100n],
        ),
      ),
    ),
    allocations: [{ address, amountWei: "100", proof: [] }],
  };
}
it("validates the beneficiary, amount and proof before wallet signing", () => {
  expect(
    parseRewardClaim(JSON.stringify(file()), address, 31337, meta).amount,
  ).toBe(100n);
  const bad = file();
  bad.allocations[0].amountWei = "101";
  expect(() =>
    parseRewardClaim(JSON.stringify(bad), address, 31337, meta),
  ).toThrow(/không khớp/);
});
it("rejects another chain, contract, wallet, malformed or oversized proof files", () => {
  for (const data of ["{}", "null", "bad json", " ".repeat(1000001)])
    expect(() => parseRewardClaim(data, address, 31337, meta)).toThrow();
  expect(() =>
    parseRewardClaim(JSON.stringify(file()), address, 43113, meta),
  ).toThrow(/mạng/);
  expect(() =>
    parseRewardClaim(JSON.stringify(file()), meta, 31337, meta),
  ).toThrow(/Ví hiện tại/);
  expect(() =>
    parseRewardClaim(JSON.stringify(file()), address, 31337, address),
  ).toThrow(/hợp đồng/);
});
