#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { parseEnv } from "node:util";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const require = createRequire(path.join(rootDir, "web/package.json"));
const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const relayEnvPath = path.join(rootDir, "packages/relay/.env.local");
const oldConfig = fs.existsSync(relayEnvPath)
  ? parseEnv(fs.readFileSync(relayEnvPath, "utf8"))
  : {};
const statePath = path.join(rootDir, ".local/anvil-state.json");
const resuming = fs.existsSync(statePath);
const relayKey =
  resuming && oldConfig.RELAY_PRIVATE_KEY
    ? oldConfig.RELAY_PRIVATE_KEY
    : generatePrivateKey();
const relaySigner = privateKeyToAccount(relayKey).address;
const binary = (name) => (process.platform === "win32" ? `${name}.exe` : name);
const children = new Set();
let stopping = false;

function cleanup(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => cleanup());
process.on("SIGTERM", () => cleanup());

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: rootDir,
    windowsHide: true,
    ...options,
  });
  children.add(child);
  child.on("close", () => children.delete(child));
  child.on("error", (error) => {
    console.error(error.message);
    cleanup(1);
  });
  return child;
}
function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = start(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    let output = "";
    child.stdout.on("data", (data) => {
      output += data;
      process.stdout.write(data);
    });
    child.stderr.on("data", (data) => process.stderr.write(data));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolve(output)
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}
function writeConfig(file, values) {
  let content = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : "# Local Anvil configuration\n";
  for (const [key, value] of Object.entries(values)) {
    const entry = `${key}=${value}`;
    const pattern = new RegExp(`^${key}=.*$`, "m");
    content = pattern.test(content)
      ? content.replace(pattern, () => entry)
      : `${content.trimEnd()}\n${entry}\n`;
  }
  fs.writeFileSync(file, content, { mode: 0o600 });
}

async function main() {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  console.log(
    "Starting Anvil on http://127.0.0.1:8545 (local test accounts only).",
  );
  const anvil = start(
    binary("anvil"),
    [
      "--host",
      "127.0.0.1",
      "--port",
      "8545",
      "--chain-id",
      "31337",
      "--quiet",
      "--state",
      statePath,
      "--state-interval",
      "5",
    ],
    { stdio: "ignore" },
  );
  let anvilError;
  anvil.on("error", (error) => {
    anvilError = error;
  });
  let exited = false;
  anvil.on("exit", () => {
    exited = true;
  });
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const check = async () => {
      if (anvilError || exited)
        return reject(
          anvilError ??
            new Error("Anvil exited. Check whether port 8545 is in use."),
        );
      try {
        const response = await fetch("http://127.0.0.1:8545", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "eth_chainId",
            params: [],
          }),
        });
        if ((await response.json()).result === "0x7a69") return resolve();
      } catch {
        /* Wait for the local RPC listener. */
      }
      if (++attempts >= 100)
        return reject(new Error("Anvil startup timed out."));
      setTimeout(check, 200);
    };
    setTimeout(check, 200);
  });

  // Fund an ephemeral relay wallet locally; no development key is embedded in source.
  if (resuming) {
    const { createPublicClient, http } = require("viem");
    const client = createPublicClient({
      transport: http("http://127.0.0.1:8545"),
    });
    const artifact = JSON.parse(
      fs.readFileSync(
        path.join(rootDir, "contracts/out/ChessEscrow.sol/ChessEscrow.json"),
        "utf8",
      ),
    );
    const signer = await client.readContract({
      address: oldConfig.ESCROW_ADDRESS,
      abi: artifact.abi,
      functionName: "relaySigner",
    });
    if (signer.toLowerCase() !== relaySigner.toLowerCase())
      throw Error(
        "Saved Anvil state does not match relay configuration. Restore the matching config; no redeployment performed.",
      );
    console.log(
      "Resumed saved Anvil state and relay configuration; existing rooms and balances retained. Start relay and web in separate terminals.",
    );
    return;
  }
  const response = await fetch("http://127.0.0.1:8545", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 2,
      method: "anvil_setBalance",
      params: [relaySigner, "0x8ac7230489e80000"],
    }),
  });
  if ((await response.json()).error)
    throw new Error("Could not fund the local relay account.");
  const output = await run(
    binary("forge"),
    [
      "script",
      "script/Deploy.s.sol:DeployScript",
      "--rpc-url",
      "http://127.0.0.1:8545",
      "--broadcast",
      "--unlocked",
      "--sender",
      "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    ],
    {
      cwd: path.join(rootDir, "contracts"),
      env: {
        ...process.env,
        RELAY_SIGNER_ADDRESS: relaySigner,
        ARBITER_ADDRESS: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
        TREASURY_ADDRESS: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
      },
    },
  );
  const escrow = output.match(
    /ChessEscrow deployed at:\s*(0x[a-fA-F0-9]{40})/,
  )?.[1];
  const meta = output.match(
    /AvaClashMeta deployed at:\s*(0x[a-fA-F0-9]{40})/,
  )?.[1];
  if (!escrow || !meta)
    throw new Error("Could not parse deployed contract addresses.");
  await run(process.execPath, [
    path.join(rootDir, "packages/shared/scripts/generate-abi.mjs"),
  ]);
  await run(
    process.execPath,
    [path.join(rootDir, "packages/shared/node_modules/typescript/bin/tsc")],
    { cwd: path.join(rootDir, "packages/shared") },
  );
  writeConfig(path.join(rootDir, "web/.env.local"), {
    NEXT_PUBLIC_ESCROW_ADDRESS: escrow,
    NEXT_PUBLIC_META_ADDRESS: meta,
    NEXT_PUBLIC_CHAIN_ID: 31337,
    NEXT_PUBLIC_RPC_URL: "http://127.0.0.1:8545",
    NEXT_PUBLIC_RELAY_URL: "ws://127.0.0.1:8080",
  });
  writeConfig(path.join(rootDir, "packages/relay/.env.local"), {
    ESCROW_ADDRESS: escrow,
    CHAIN_ID: 31337,
    RPC_URL: "http://127.0.0.1:8545",
    PORT: 8080,
    RELAY_PRIVATE_KEY: relayKey,
    RELAY_SIGNER_ADDRESS: relaySigner,
    ALLOWED_ORIGINS: "http://localhost:3000,http://127.0.0.1:3000",
    ALLOW_NO_ORIGIN: false,
    RESULTS_DIR: path.join(rootDir, ".local/relay", randomUUID(), "results"),
  });
  console.log(
    "Local contracts and .env.local files are ready. Anvil remains running until Ctrl+C.",
  );
  console.log(
    "In two other terminals run: pnpm --filter @avaclash/relay start and pnpm --filter web dev.",
  );
  console.log(
    "Use Anvil test accounts 4 and 5 in separate browser profiles. Never fund these public accounts with real assets.",
  );
}
main().catch((error) => {
  console.error(error.message);
  cleanup(1);
});
