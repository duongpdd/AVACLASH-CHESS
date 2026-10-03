import { describe, it, expect } from "vitest";
import {
  getEip712Domain,
  EIP712_TYPES,
  buildResultTypedData,
  FUJI_CHAIN_ID,
  ZERO_ADDRESS,
} from "../src/eip712.js";

const MOCK_CONTRACT: `0x${string}` = "0x1234567890abcdef1234567890abcdef12345678";
const MOCK_WINNER: `0x${string}` = "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd";
const MOCK_HASH: `0x${string}` =
  "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd";

describe("getEip712Domain", () => {
  it("should return correct domain with default chain ID", () => {
    const domain = getEip712Domain(MOCK_CONTRACT);
    expect(domain.name).toBe("AvaClashChess");
    expect(domain.version).toBe("1");
    expect(domain.chainId).toBe(BigInt(FUJI_CHAIN_ID));
    expect(domain.verifyingContract).toBe(MOCK_CONTRACT);
  });

  it("should accept custom chain ID", () => {
    const domain = getEip712Domain(MOCK_CONTRACT, 1);
    expect(domain.chainId).toBe(1n);
  });
});

describe("EIP712_TYPES", () => {
  it("should have Result type with correct fields", () => {
    expect(EIP712_TYPES.Result).toEqual([
      { name: "matchId", type: "uint256" },
      { name: "winner", type: "address" },
      { name: "movesHash", type: "bytes32" },
      { name: "nonce", type: "uint256" },
    ]);
  });

  it("should have exactly 4 fields", () => {
    expect(EIP712_TYPES.Result).toHaveLength(4);
  });
});

describe("buildResultTypedData", () => {
  it("should build complete typed data object", () => {
    const typedData = buildResultTypedData(MOCK_CONTRACT, {
      matchId: 1n,
      winner: MOCK_WINNER,
      movesHash: MOCK_HASH,
      nonce: 42n,
    });

    expect(typedData.domain.name).toBe("AvaClashChess");
    expect(typedData.domain.verifyingContract).toBe(MOCK_CONTRACT);
    expect(typedData.types).toBe(EIP712_TYPES);
    expect(typedData.primaryType).toBe("Result");
    expect(typedData.message.matchId).toBe(1n);
    expect(typedData.message.winner).toBe(MOCK_WINNER);
    expect(typedData.message.movesHash).toBe(MOCK_HASH);
    expect(typedData.message.nonce).toBe(42n);
  });

  it("should handle draw (zero address winner)", () => {
    const typedData = buildResultTypedData(MOCK_CONTRACT, {
      matchId: 5n,
      winner: ZERO_ADDRESS,
      movesHash: MOCK_HASH,
      nonce: 1n,
    });

    expect(typedData.message.winner).toBe(ZERO_ADDRESS);
  });

  it("should use custom chain ID", () => {
    const typedData = buildResultTypedData(
      MOCK_CONTRACT,
      {
        matchId: 1n,
        winner: MOCK_WINNER,
        movesHash: MOCK_HASH,
        nonce: 1n,
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
