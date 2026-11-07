import { formatEther } from "viem";
import { CURRENCY_SYMBOL } from "@/config/env";

export function formatCurrency(value: bigint, suffix = "") {
  return `${formatEther(value)} ${CURRENCY_SYMBOL}${suffix}`;
}
