import { isAddress } from "viem";

export const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000" as const;

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "43113");
export const CURRENCY_SYMBOL = CHAIN_ID === 31337 ? "ETH" : "AVAX";
export const NETWORK_NAME =
  CHAIN_ID === 31337 ? "Anvil Local" : "Avalanche Fuji";

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (CHAIN_ID === 31337
    ? "http://127.0.0.1:8545"
    : "https://api.avax-test.network/ext/bc/C/rpc");

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
  ZERO_ADDRESS) as `0x${string}`;

export const META_ADDRESS = (process.env.NEXT_PUBLIC_META_ADDRESS ||
  ZERO_ADDRESS) as `0x${string}`;

export const TOURNAMENT_ADDRESS = (process.env.NEXT_PUBLIC_TOURNAMENT_ADDRESS ||
  ZERO_ADDRESS) as `0x${string}`;
export const tournamentEnabled =
  validateAddressConfig(TOURNAMENT_ADDRESS).valid;

export const RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL || "ws://localhost:8080";

export const UI_MAX_STAKE = process.env.NEXT_PUBLIC_UI_MAX_STAKE || "0.1";

/**
 * Validates whether an address string is a syntactically valid EVM address
 * and is not the 0x0 zero address.
 */
export function validateAddressConfig(addr: string | undefined): {
  valid: boolean;
  error?: string;
} {
  if (!addr || !isAddress(addr)) {
    return { valid: false, error: "Địa chỉ không đúng định dạng EVM (0x...)." };
  }
  if (addr.toLowerCase() === ZERO_ADDRESS.toLowerCase()) {
    return {
      valid: false,
      error: "Địa chỉ chưa được cấu hình (đang là địa chỉ 0x0).",
    };
  }
  return { valid: true };
}

export const escrowAddressValidation = validateAddressConfig(ESCROW_ADDRESS);
export const metaAddressValidation = validateAddressConfig(META_ADDRESS);

export const isAddressConfigOk =
  escrowAddressValidation.valid && metaAddressValidation.valid;

export function getAddressConfigError(): string | null {
  if (![31337, 43113].includes(CHAIN_ID))
    return "Chỉ hỗ trợ mạng thử nghiệm Anvil (31337) hoặc Fuji (43113).";
  if (!escrowAddressValidation.valid) {
    return `NEXT_PUBLIC_ESCROW_ADDRESS (${ESCROW_ADDRESS}): ${escrowAddressValidation.error}`;
  }
  if (!metaAddressValidation.valid) {
    return `NEXT_PUBLIC_META_ADDRESS (${META_ADDRESS}): ${metaAddressValidation.error}`;
  }
  return null;
}

// Log warning to console at startup if configuration is missing/invalid
if (typeof window !== "undefined") {
  const configErr = getAddressConfigError();
  if (configErr) {
    console.warn(`[Config Check] Cảnh báo khởi động: ${configErr}`);
  }
}
