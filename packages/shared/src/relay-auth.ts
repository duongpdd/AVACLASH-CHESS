/** Join v2 binds authentication to the escrow deployment and browser origin. */
export function buildBoundJoinTypedData(
  roomId: bigint | number,
  player: `0x${string}`,
  nonce: `0x${string}`,
  expiresAt: bigint | number,
  chainId: number,
  binding: { escrowAddress: `0x${string}`; origin: string },
) {
  return {
    domain: {
      name: "AvaClashRelay",
      version: "2",
      chainId: BigInt(chainId),
      verifyingContract: binding.escrowAddress,
    },
    types: {
      Join: [
        { name: "roomId", type: "uint256" },
        { name: "player", type: "address" },
        { name: "nonce", type: "bytes32" },
        { name: "expiresAt", type: "uint256" },
        { name: "origin", type: "string" },
      ],
    },
    primaryType: "Join" as const,
    message: {
      roomId: BigInt(roomId),
      player,
      nonce,
      expiresAt: BigInt(expiresAt),
      origin: binding.origin,
    },
  } as const;
}
