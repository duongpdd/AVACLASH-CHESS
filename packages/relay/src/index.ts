import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RelayServer } from "./RelayServer.js";
import { createServer } from "node:http";
import { checkReadiness } from "./readiness.js";
import {
  assertRailwayDeployment,
  assertRenderDeployment,
} from "./deployment.js";

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

try {
  assertRailwayDeployment(process.env);
  assertRenderDeployment(process.env);
} catch (error) {
  console.error(
    "FATAL:",
    error instanceof Error
      ? error.message
      : "Invalid deployment configuration.",
  );
  process.exit(1);
}

const port = Number(process.env.PORT ?? process.env.RELAY_PORT ?? 8080);
const chainId = process.env.CHAIN_ID
  ? parseInt(process.env.CHAIN_ID, 10)
  : 43113;

if (![31337, 43113].includes(chainId)) {
  console.error("FATAL: Only Anvil (31337) or Fuji (43113) is supported.");
  process.exit(1);
}

const relayPrivateKey = process.env.RELAY_PRIVATE_KEY as
  `0x${string}` | undefined;

if (!relayPrivateKey) {
  console.error("FATAL: RELAY_PRIVATE_KEY environment variable is required.");
  process.exit(1);
}

const contractAddress = (process.env.ESCROW_ADDRESS ??
  process.env.CHESS_ESCROW_ADDRESS) as `0x${string}` | undefined;
if (
  !contractAddress ||
  contractAddress === "0x0000000000000000000000000000000000000000"
) {
  console.error(
    "FATAL: ESCROW_ADDRESS environment variable is required and cannot be zero address.",
  );
  process.exit(1);
}
const rpcUrl =
  process.env.RPC_URL ??
  (chainId === 31337 ? "http://127.0.0.1:8545" : undefined);
if (!rpcUrl) {
  console.error("FATAL: RPC_URL environment variable is required.");
  process.exit(1);
}

let readiness: Promise<void> | undefined;
let lastReadinessAt = 0;
function cachedReadiness() {
  if (!readiness || Date.now() - lastReadinessAt > 3000) {
    lastReadinessAt = Date.now();
    readiness = checkReadiness(server);
  }
  return readiness;
}
const httpServer = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (
    req.method !== "GET" ||
    !["/healthz", "/readyz"].includes(req.url ?? "")
  ) {
    res.writeHead(404);
    res.end('{"status":"not_found"}');
    return;
  }
  if (req.url === "/healthz") {
    if (server.storageFailed) {
      res.writeHead(503);
      res.end('{"status":"restart_required"}');
      return;
    }
    res.end('{"status":"alive"}');
    return;
  }
  try {
    await cachedReadiness();
    res.end('{"status":"ready"}');
  } catch {
    res.writeHead(503);
    res.end('{"status":"unavailable"}');
  }
});
const server = new RelayServer({
  server: httpServer,
  relayPrivateKey,
  contractAddress,
  rpcUrl,
  chainId,
  databaseUrl:
    process.env.STORAGE_DRIVER === "postgres"
      ? process.env.DATABASE_URL
      : undefined,
});
try {
  if (process.env.STORAGE_DRIVER === "postgres" && !process.env.DATABASE_URL)
    throw Error("DATABASE_URL is required with STORAGE_DRIVER=postgres.");
  if (
    process.env.STORAGE_DRIVER &&
    !["postgres", "file"].includes(process.env.STORAGE_DRIVER)
  )
    throw Error("Unknown STORAGE_DRIVER; use postgres or file.");
  await server.initialize();
  await checkReadiness(server);
} catch (error) {
  console.error(
    "FATAL: Relay readiness check failed:",
    server.store
      ? "Database or chain dependency unavailable; check configuration and migration."
      : error instanceof Error
        ? error.message
        : "dependency failure",
  );
  await server.close();
  process.exit(1);
}
httpServer.listen(port, process.env.HOST ?? "127.0.0.1");
let shuttingDown = false;
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    const deadline = setTimeout(() => process.exit(1), 5000);
    deadline.unref();
    httpServer.close();
    await server.close();
    clearTimeout(deadline);
  });

console.log(`[AvaClash Relay] Running on ws://localhost:${port}`);
console.log(`[AvaClash Relay] Signer address: ${server.relayAddress}`);
console.log(
  `[AvaClash Relay] Contract: ${contractAddress} (Chain: ${chainId})`,
);

export { RelayServer };
