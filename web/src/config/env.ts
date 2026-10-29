export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID || "43113");

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  (CHAIN_ID === 31337
    ? "http://127.0.0.1:8545"
    : "https://api.avax-test.network/ext/bc/C/rpc");

export const ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_ESCROW_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const META_ADDRESS = (process.env.NEXT_PUBLIC_META_ADDRESS ||
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const RELAY_URL =
  process.env.NEXT_PUBLIC_RELAY_URL || "ws://localhost:8080";

export const UI_MAX_STAKE =
  process.env.NEXT_PUBLIC_UI_MAX_STAKE || "0.1";
