import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RelayServer } from "./RelayServer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Automatically load .env.local or .env if present
const candidateEnvFiles = [
  path.resolve(__dirname, "../.env.local"),
  path.resolve(__dirname, "../.env"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "packages/relay/.env.local"),
];

for (const envFile of candidateEnvFiles) {
  if (fs.existsSync(envFile)) {
    try {
      if (typeof process.loadEnvFile === "function") {
        process.loadEnvFile(envFile);
      }
    } catch {}
  }
}

const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 8080;
const chainId = process.env.CHAIN_ID ? parseInt(process.env.CHAIN_ID, 10) : 43113;

let relayPrivateKey = process.env.RELAY_PRIVATE_KEY as `0x${string}` | undefined;

// Fallback for local Anvil devnet (Chain ID 31337): use well-known Anvil Account 1 key
if (!relayPrivateKey && chainId === 31337) {
  relayPrivateKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
}

if (!relayPrivateKey) {
  console.error("FATAL: RELAY_PRIVATE_KEY environment variable is required.");
  process.exit(1);
}

const contractAddress = (process.env.ESCROW_ADDRESS ?? process.env.CHESS_ESCROW_ADDRESS) as `0x${string}` | undefined;
if (!contractAddress || contractAddress === "0x0000000000000000000000000000000000000000") {
  console.error("FATAL: ESCROW_ADDRESS environment variable is required and cannot be zero address.");
  process.exit(1);
}
const rpcUrl = process.env.RPC_URL ?? (chainId === 31337 ? "http://127.0.0.1:8545" : undefined);
if (!rpcUrl) {
  console.error("FATAL: RPC_URL environment variable is required.");
  process.exit(1);
}

const server = new RelayServer({
  port,
  relayPrivateKey,
  contractAddress,
  rpcUrl,
  chainId,
});

console.log(`[AvaClash Relay] Running on ws://localhost:${port}`);
console.log(`[AvaClash Relay] Signer address: ${server.relayAddress}`);
console.log(`[AvaClash Relay] Contract: ${contractAddress} (Chain: ${chainId})`);

export { RelayServer };
