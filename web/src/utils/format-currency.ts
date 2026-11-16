import { formatEther } from "viem";
import { CURRENCY_SYMBOL } from "@/config/env";

export function formatCurrency(value: bigint, suffix = "", locale?: string) {
  const ether = formatEther(value);
  if (!locale) return `${ether} ${CURRENCY_SYMBOL}${suffix}`;
  const [whole, fraction] = ether.split(".");
  const formatter = new Intl.NumberFormat(locale);
  const decimal = formatter
    .formatToParts(1.1)
    .find((p) => p.type === "decimal")!.value;
  const integer = formatter.format(BigInt(whole));
  const sign = value < 0n && BigInt(whole) === 0n ? "-" : "";
  return `${sign}${integer}${fraction ? decimal + fraction : ""} ${CURRENCY_SYMBOL}${suffix}`;
}
