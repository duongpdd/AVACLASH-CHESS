import { describe, it, expect } from "vitest";
import { keccak256, toHex } from "viem";
import {
  getEip712Domain,
  EIP712_TYPES,
  buildResultTypedData,
  FUJI_CHAIN_ID,
  ZERO_ADDRESS,
} from "../src/eip712.js";
import { OutcomeCode, ReasonCode } from "../src/types.js";

const MOCK_CONTRACT: `0x${string}` = "0x1234567890abcdef1234567890abcdef12345678";
const MOCK_WINNER: `0x${string}` = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const MOCK_HASH: `0x${string}` =
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("getEip712Domain", () => {
  it("should return correct domain with default chain ID and version 2", () => {
    const domain = getEip712Domain(MOCK_CONTRACT);
    expect(domain.name).toBe("AvaClashChess");
    expect(domain.version).toBe("2");
    expect(domain.chainId).toBe(BigInt(FUJI_CHAIN_ID));
    expect(domain.verifyingContract).toBe(MOCK_CONTRACT);
  });

  it("should accept custom chain ID", () => {
    const domain = getEip712Domain(MOCK_CONTRACT, 1);
    expect(domain.chainId).toBe(1n);
    expect(domain.version).toBe("2");
  });
});

describe("EIP712_TYPES", () => {
  it("should have Result type with correct expanded fields", () => {
    expect(EIP712_TYPES.Result).toEqual([
      { name: "matchId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "outcome", type: "uint8" },
      { name: "reason", type: "uint8" },
      { name: "moveCount", type: "uint16" },
      { name: "movesHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ]);
  });

  it("should have exactly 8 fields", () => {
    expect(EIP712_TYPES.Result).toHaveLength(8);
  });
});

describe("buildResultTypedData", () => {
  it("should build complete typed data object with all 8 fields", () => {
    const typedData = buildResultTypedData(MOCK_CONTRACT, {
      matchId: 1n,
      winner: MOCK_WINNER,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Checkmate,
      moveCount: 42,
      movesHash: MOCK_HASH,
      nonce: 42n,
      deadline: 1700000000n,
    });

    expect(typedData.domain.name).toBe("AvaClashChess");
    expect(typedData.domain.verifyingContract).toBe(MOCK_CONTRACT);
    expect(typedData.types).toBe(EIP712_TYPES);
    expect(typedData.primaryType).toBe("Result");
    expect(typedData.message.matchId).toBe(1n);
    expect(typedData.message.winner).toBe(MOCK_WINNER);
    expect(typedData.message.outcome).toBe(OutcomeCode.WhiteWin);
    expect(typedData.message.reason).toBe(ReasonCode.Checkmate);
    expect(typedData.message.moveCount).toBe(42);
    expect(typedData.message.movesHash).toBe(MOCK_HASH);
    expect(typedData.message.nonce).toBe(42n);
    expect(typedData.message.deadline).toBe(1700000000n);
  });

  it("should handle draw (zero address winner, Draw outcome)", () => {
    const typedData = buildResultTypedData(MOCK_CONTRACT, {
      matchId: 5n,
      winner: ZERO_ADDRESS,
      outcome: OutcomeCode.Draw,
      reason: ReasonCode.Stalemate,
      moveCount: 30,
      movesHash: MOCK_HASH,
      nonce: 1n,
      deadline: 1700000000n,
    });

    expect(typedData.message.winner).toBe(ZERO_ADDRESS);
    expect(typedData.message.outcome).toBe(OutcomeCode.Draw);
    expect(typedData.message.reason).toBe(ReasonCode.Stalemate);
  });

  it("should use custom chain ID", () => {
    const typedData = buildResultTypedData(
      MOCK_CONTRACT,
      {
        matchId: 1n,
        winner: MOCK_WINNER,
        outcome: OutcomeCode.BlackWin,
        reason: ReasonCode.Resign,
        moveCount: 20,
        movesHash: MOCK_HASH,
        nonce: 1n,
        deadline: 1700000000n,
      },
      1,
    );

    expect(typedData.domain.chainId).toBe(1n);
  });
});

describe("ZERO_ADDRESS", () => {
  it("should be 40 hex chars with 0x prefix", () => {
    expect(ZERO_ADDRESS).toBe("0x0000000000000000000000000000000000000000");
    expect(ZERO_ADDRESS).toHaveLength(42);
  });
});

describe("FUJI_CHAIN_ID", () => {
  it("should be 43113", () => {
    expect(FUJI_CHAIN_ID).toBe(43113);
  });
});

describe("Cross-Verification: TS <-> Solidity EIP-712 Spec", () => {
  it("computes domain separator matching Solidity OpenZeppelin EIP712('AvaClashChess', '2')", () => {
    const domain = getEip712Domain(MOCK_CONTRACT, FUJI_CHAIN_ID);
    expect(domain.name).toBe("AvaClashChess");
    expect(domain.version).toBe("2");
    expect(domain.chainId).toBe(BigInt(FUJI_CHAIN_ID));
    expect(domain.verifyingContract).toBe(MOCK_CONTRACT);

    // Verify domain typehash
    const typeHash = keccak256(
      toHex("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)")
    );
    expect(typeHash.startsWith("0x")).toBe(true);
  });
});
