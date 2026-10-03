import { describe, it, expect } from "vitest";
import { computeMovesHash, movesToString } from "../src/hash.js";
import { keccak256, toHex } from "viem";

describe("computeMovesHash", () => {
  it("should produce deterministic hash for same moves", () => {
    const moves = ["e2e4", "e7e5", "g1f3"];
    const hash1 = computeMovesHash(moves);
    const hash2 = computeMovesHash(moves);
    expect(hash1).toBe(hash2);
  });

  it("should produce different hash for different moves", () => {
    const hash1 = computeMovesHash(["e2e4", "e7e5"]);
    const hash2 = computeMovesHash(["d2d4", "d7d5"]);
    expect(hash1).not.toBe(hash2);
  });

  it("should match manual keccak256 of joined string", () => {
    const moves = ["e2e4", "e7e5", "g1f3"];
    const expected = keccak256(toHex(new TextEncoder().encode("e2e4 e7e5 g1f3")));
    expect(computeMovesHash(moves)).toBe(expected);
  });

  it("should hash empty game (empty string)", () => {
    const hash = computeMovesHash([]);
    const expected = keccak256(toHex(new TextEncoder().encode("")));
    expect(hash).toBe(expected);
  });

  it("should produce a valid bytes32 hex string", () => {
    const hash = computeMovesHash(["e2e4"]);
    expect(hash).toMatch(/^0x[a-f0-9]{64}$/);
  });

  it("should handle single move", () => {
    const hash = computeMovesHash(["e2e4"]);
    const expected = keccak256(toHex(new TextEncoder().encode("e2e4")));
    expect(hash).toBe(expected);
  });

  it("should handle promotion moves", () => {
    const hash = computeMovesHash(["a7a8q"]);
    const expected = keccak256(toHex(new TextEncoder().encode("a7a8q")));
    expect(hash).toBe(expected);
  });
});

describe("movesToString", () => {
  it("should join moves with spaces", () => {
    expect(movesToString(["e2e4", "e7e5"])).toBe("e2e4 e7e5");
  });

  it("should return empty string for empty array", () => {
    expect(movesToString([])).toBe("");
  });
});
