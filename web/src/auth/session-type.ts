import { isAddress, type Address } from "viem";
import { z } from "zod";

export const walletAddress = z.custom<Address>(
  (value) => typeof value === "string" && isAddress(value, { strict: false }),
);
export type WalletSession = {
  token: string;
  user: { address: Address };
  expiresAt: number;
};
