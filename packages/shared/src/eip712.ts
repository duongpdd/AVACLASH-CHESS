import type { ResultMessage } from "./types.js";

/**
 * Avalanche Fuji C-Chain ID.
 */
export const FUJI_CHAIN_ID = 43113;

/**
 * EIP-712 domain definition for AvaClash Chess.
 * verifyingContract must be filled in at runtime after deployment.
 */
export function getEip712Domain(verifyingContract: `0x${string}`, chainId: number = FUJI_CHAIN_ID) {
  return {
    name: "AvaClashChess",
    version: "2",
    chainId: BigInt(chainId),
    verifyingContract,
  } as const;
}

/**
 * EIP-712 types definition for the expanded Result struct.
 * Matches Solidity: Result(uint256 matchId, address winner, uint8 outcome,
 *   uint8 reason, uint16 moveCount, bytes32 movesHash, uint256 nonce, uint256 deadline)
 */
export const EIP712_TYPES = {
  Result: [
    { name: "matchId", type: "uint256" },
    { name: "winner", type: "address" },
    { name: "outcome", type: "uint8" },
    { name: "reason", type: "uint8" },
    { name: "moveCount", type: "uint16" },
    { name: "movesHash", type: "bytes32" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Build the typed data for EIP-712 signing with viem/wagmi.
 *
 * Usage with viem:
 *   walletClient.signTypedData({
 *     domain: getEip712Domain(contractAddress),
 *     types: EIP712_TYPES,
 *     primaryType: "Result",
 *     message: { matchId, winner, outcome, reason, moveCount, movesHash, nonce, deadline },
 *   })
 */
export function buildResultTypedData(
  contractAddress: `0x${string}`,
  result: ResultMessage,
  chainId: number = FUJI_CHAIN_ID,
) {
  return {
    domain: getEip712Domain(contractAddress, chainId),
    types: EIP712_TYPES,
    primaryType: "Result" as const,
    message: {
      matchId: result.matchId,
      winner: result.winner,
      outcome: result.outcome,
      reason: result.reason,
      moveCount: result.moveCount,
      movesHash: result.movesHash,
      nonce: result.nonce,
      deadline: result.deadline,
    },
  };
}

/**
 * Zero address constant for draw results.
 */
export const ZERO_ADDRESS: `0x${string}` = "0x0000000000000000000000000000000000000000";

/**
 * EIP-712 domain definition for Relay Join authentication.
 * Distinct from Result domain (does not use verifyingContract).
 */
export function getRelayEip712Domain(chainId: number = FUJI_CHAIN_ID) {
  return {
    name: "AvaClashRelay",
    version: "1",
    chainId: BigInt(chainId),
  } as const;
}

/**
 * EIP-712 types definition for Relay Join message.
 * Join(uint256 roomId, address player, bytes32 nonce, uint256 expiresAt)
 */
export const RELAY_EIP712_TYPES = {
  Join: [
    { name: "roomId", type: "uint256" },
    { name: "player", type: "address" },
    { name: "nonce", type: "bytes32" },
    { name: "expiresAt", type: "uint256" },
  ],
} as const;

/**
 * Build typed data for Relay Join authentication.
 */
export function buildJoinTypedData(
  roomId: bigint | number,
  player: `0x${string}`,
  nonce: `0x${string}`,
  expiresAt: bigint | number,
  chainId: number = FUJI_CHAIN_ID,
) {
  return {
    domain: getRelayEip712Domain(chainId),
    types: RELAY_EIP712_TYPES,
    primaryType: "Join" as const,
    message: {
      roomId: BigInt(roomId),
      player,
      nonce,
      expiresAt: BigInt(expiresAt),
    },
  };
}
