#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "web/package.json"));
const {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} = require("viem");
const { generatePrivateKey, privateKeyToAccount } = require("viem/accounts");
const { anvil } = require("viem/chains");
const rpcUrl = "http://127.0.0.1:18545";
const webUrl = "http://127.0.0.1:13000";
const relayUrl = "http://127.0.0.1:18080";
const relayKey = generatePrivateKey();
const relaySigner = privateKeyToAccount(relayKey).address;
const children = new Set();
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

function spawnChild(
  command,
  args,
  { cwd = root, env = process.env, quiet = false } = {},
) {
  const child = spawn(command, args, {
    cwd,
    env,
    windowsHide: true,
    stdio: quiet ? "ignore" : "inherit",
  });
  children.add(child);
  child.once("exit", () => children.delete(child));
  child.once("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  return child;
}
function run(command, args) {
  const child = spawnChild(command, args);
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0 ? resolve() : reject(Error(`${command} exited (${code})`)),
    );
  });
}
function serve(command, args, options) {
  const child = spawnChild(command, args, options);
  child.once("exit", (code) => {
    if (!stopping) {
      console.error(`${command} stopped (${code})`);
      stop(1);
    }
  });
  return child;
}
async function waitUntil(check, label) {
  for (let i = 0; i < 100 && !stopping; i++) {
    try {
      if (await check()) return;
    } catch {}
    await delay(200);
  }
  throw Error(`${label} not ready. Check local ports and the logs above.`);
}

async function main() {
  const work = path.join(root, ".local");
  mkdirSync(work, { recursive: true });
  const directory = mkdtempSync(path.join(work, "tournament-demo-"));
  const chain = { ...anvil, rpcUrls: { default: { http: [rpcUrl] } } };
  const rpc = createPublicClient({
    chain,
    transport: http(rpcUrl, { retryCount: 0, timeout: 700 }),
    pollingInterval: 100,
  });
  // Never send demo transactions to a chain already listening on the demo port.
  let occupied = false;
  try {
    await rpc.getChainId();
    occupied = true;
  } catch {}
  if (occupied)
    throw Error(
      "Port 18545 already has an RPC. Stop that demo before starting another.",
    );
  serve(
    "anvil",
    [
      "--host",
      "127.0.0.1",
      "--port",
      "18545",
      "--chain-id",
      "31337",
      "--quiet",
    ],
    { quiet: true },
  );
  await waitUntil(async () => (await rpc.getChainId()) === 31337, "Anvil");
  await run("forge", [
    "build",
    "--root",
    "contracts",
    "--skip",
    "test",
    "--skip",
    "script",
    "--quiet",
  ]);
  await run(process.execPath, ["packages/shared/scripts/generate-abi.mjs"]);
  const tsc = path.join(root, "node_modules/typescript/bin/tsc");
  await run(process.execPath, [tsc, "-p", "packages/shared/tsconfig.json"]);
  await run(process.execPath, [tsc, "-p", "packages/relay/tsconfig.json"]);
  const { abi, bytecode } = JSON.parse(
    readFileSync(
      path.join(
        root,
        "contracts/out/TournamentPrizePool.sol/TournamentPrizePool.json",
      ),
      "utf8",
    ),
  );
  const wallet = createWalletClient({
    chain,
    transport: http(rpcUrl),
    pollingInterval: 100,
  });
  const [organizer, reviewer, ...players] = await wallet.getAddresses();
  if (!organizer || !reviewer || players.length !== 8)
    throw Error("Expected ten funded local Anvil test accounts.");
  const confirm = async (hash) => {
    const receipt = await rpc.waitForTransactionReceipt({ hash: await hash });
    if (receipt.status !== "success")
      throw Error("Local demo transaction reverted.");
    return receipt;
  };
  const deployed = await confirm(
    wallet.deployContract({
      abi,
      bytecode: bytecode.object,
      account: organizer,
      args: [relaySigner],
    }),
  );
  const address = deployed.contractAddress;
  if (!address) throw Error("Tournament deployment has no address.");
  const tx = (account, functionName, args, value) =>
    confirm(
      wallet.writeContract({
        account,
        address,
        abi,
        functionName,
        args,
        value,
      }),
    );
  if (process.argv.includes("--seed")) {
    const t = (await rpc.getBlock()).timestamp;
    await tx(organizer, "createTournament", [
      "AvaClash Campus Cup",
      "Giải demo 5+0. Kỳ thủ chọn ván theo lịch BTC. Trọng tài kiểm tra biên bản, giải quyết khiếu nại trước khi chốt giải.",
      8,
      reviewer,
      t + 86400n,
      t + 7n * 86400n,
      3600n,
    ]);
    await tx(organizer, "fund", [0n], parseEther("0.1"));
    for (const player of players) await tx(player, "register", [0n]);
    await tx(organizer, "start", [0n]);
  }
  console.log(
    `\nTournament: ${address}\nOrganizer: ${organizer}\nReviewer: ${reviewer}\nAnvil RPC: ${rpcUrl}\nWeb: ${webUrl}/tournaments\n`,
  );
  serve(process.execPath, ["dist/index.js"], {
    cwd: path.join(root, "packages/relay"),
    env: {
      ...process.env,
      RENDER: "false",
      RAILWAY_ENVIRONMENT_ID: "",
      STORAGE_DRIVER: "file",
      DATABASE_URL: "",
      CHAIN_ID: "31337",
      TOURNAMENT_ADDRESS: address,
      RPC_URL: rpcUrl,
      PORT: "18080",
      HOST: "127.0.0.1",
      RELAY_PRIVATE_KEY: relayKey,
      RESULTS_DIR: directory,
      ACTIVE_DIR: path.join(directory, "active"),
      ALLOWED_ORIGINS: `${webUrl},http://localhost:13000`,
      ALLOW_NO_ORIGIN: "false",
      TRUST_PROXY: "false",
    },
  });
  await waitUntil(
    async () =>
      (await fetch(`${relayUrl}/readyz`, { signal: AbortSignal.timeout(800) }))
        .ok,
    "Tournament relay",
  );
  serve(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "--hostname",
      "127.0.0.1",
      "--port",
      "13000",
    ],
    {
      cwd: path.join(root, "web"),
      env: {
        ...process.env,
        NEXT_PUBLIC_TOURNAMENT_ADDRESS: address,
        NEXT_PUBLIC_CHAIN_ID: "31337",
        NEXT_PUBLIC_RPC_URL: rpcUrl,
        NEXT_PUBLIC_RELAY_URL: "ws://127.0.0.1:18080",
      },
    },
  );
}

main().catch((error) => {
  console.error(error.message);
  stop(1);
});
