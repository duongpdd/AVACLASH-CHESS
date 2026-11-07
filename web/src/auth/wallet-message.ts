import { getAddress } from "viem";
import { createSiweMessage } from "viem/siwe";
import { CHAIN_ID } from "@/config/env";
import type { Claims } from "./session-token";

export function walletMessage(challenge: Claims) {
  return createSiweMessage({
    address: getAddress(challenge.address),
    chainId: CHAIN_ID,
    domain: new URL(challenge.origin).host,
    nonce: challenge.id,
    uri: challenge.origin,
    version: "1",
    issuedAt: new Date(challenge.issuedAt),
    expirationTime: new Date(challenge.expiresAt),
  });
}
