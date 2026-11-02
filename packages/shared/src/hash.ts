import { keccak256, toHex } from "viem";

/**
 * Compute the moves hash matching the Solidity contract.
 *
 * Hash = keccak256(abi.encodePacked(string)) where string is
 * UCI moves joined by spaces (e.g., "e2e4 e7e5 g1f3").
 * An empty game (0 moves) hashes the empty string.
 *
 * This must produce the same result as Solidity:
 *   keccak256(abi.encodePacked("e2e4 e7e5 g1f3"))
 *
 * @param moves - Array of UCI move strings
 * @returns bytes32 hash as hex string
 */
export function computeMovesHash(moves: string[]): `0x${string}` {
  const movesString = moves.join(" ");
  // abi.encodePacked(string) = raw UTF-8 bytes of the string
  const encoded = toHex(new TextEncoder().encode(movesString));
  return keccak256(encoded);
}

/**
 * Build the UCI moves string from an array (for display/debug).
 */
export function movesToString(moves: string[]): string {
  return moves.join(" ");
}
