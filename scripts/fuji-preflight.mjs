#!/usr/bin/env node
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import {
  validAddress,
  validateFujiRoles,
  validatePublicDeployment,
} from "./deploy-config.mjs";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const {
  createPublicClient,
  http,
  formatEther,
  parseEther,
  parseAbi,
} = require("viem");
const getters = parseAbi([
  "function relaySigner() view returns (address)",
  "function arbiter() view returns (address)",
  "function treasury() view returns (address)",
  "function metaContract() view returns (address)",
  "function escrowContract() view returns (address)",
  "function owner() view returns (address)",
  "function singleSignedEnabled() view returns (bool)",
  "function spectatorBettingEnabled() view returns (bool)",
]);

export async function runFujiPreflight(env, { deployed = false, client } = {}) {
  const rpc =
    env.FUJI_RPC_URL ||
    env.NEXT_PUBLIC_RPC_URL ||
    "https://api.avax-test.network/ext/bc/C/rpc";
  client ??= createPublicClient({
    transport: http(rpc, { timeout: 10000, retryCount: 0 }),
  });
  const checks = [];
  const check = (name, pass, details = {}) =>
    checks.push({ check: name, pass: !!pass, ...details });
  for (const error of validateFujiRoles(env)) check(error, false);
  const inspectContracts =
    deployed ||
    validAddress(env.NEXT_PUBLIC_ESCROW_ADDRESS) ||
    validAddress(env.NEXT_PUBLIC_META_ADDRESS);
  if (inspectContracts)
    for (const error of validatePublicDeployment(env)) check(error, false);
  let correctChain = false;
  try {
    correctChain = (await client.getChainId()) === 43113;
  } catch {}
  check("RPC chain 43113", correctChain);
  // Do not inspect a different chain and label its balances or bytecode Fuji.
  if (correctChain) {
    for (const name of ["DEPLOYER_ADDRESS", "RELAY_SIGNER_ADDRESS"]) {
      if (!validAddress(env[name])) continue;
      try {
        const balance = await client.getBalance({ address: env[name] });
        check(
          `${name} test AVAX`,
          name === "RELAY_SIGNER_ADDRESS"
            ? balance >= parseEther("0.1")
            : balance > 0n,
          { balance: formatEther(balance) },
        );
      } catch {
        check(`${name} balance readable`, false);
      }
    }
    if (inspectContracts) {
      for (const name of [
        "NEXT_PUBLIC_ESCROW_ADDRESS",
        "NEXT_PUBLIC_META_ADDRESS",
      ]) {
        if (!validAddress(env[name])) continue;
        try {
          const code = await client.getCode({ address: env[name] });
          check(`${name} bytecode`, !!code && code !== "0x");
        } catch {
          check(`${name} bytecode`, false);
        }
      }
      const same = (a, b) =>
        typeof b === "string" && String(a).toLowerCase() === b.toLowerCase();
      const reads = [
        ["NEXT_PUBLIC_ESCROW_ADDRESS", "relaySigner", env.RELAY_SIGNER_ADDRESS],
        ["NEXT_PUBLIC_ESCROW_ADDRESS", "arbiter", env.ARBITER_ADDRESS],
        ["NEXT_PUBLIC_ESCROW_ADDRESS", "treasury", env.TREASURY_ADDRESS],
        ["NEXT_PUBLIC_ESCROW_ADDRESS", "owner", env.DEPLOYER_ADDRESS],
        ["NEXT_PUBLIC_META_ADDRESS", "owner", env.DEPLOYER_ADDRESS],
        [
          "NEXT_PUBLIC_ESCROW_ADDRESS",
          "metaContract",
          env.NEXT_PUBLIC_META_ADDRESS,
        ],
        [
          "NEXT_PUBLIC_META_ADDRESS",
          "escrowContract",
          env.NEXT_PUBLIC_ESCROW_ADDRESS,
        ],
        ["NEXT_PUBLIC_ESCROW_ADDRESS", "singleSignedEnabled", false],
        ["NEXT_PUBLIC_META_ADDRESS", "spectatorBettingEnabled", false],
      ];
      for (const [name, functionName, expected] of reads) {
        if (!validAddress(env[name])) continue;
        try {
          const actual = await client.readContract({
            address: env[name],
            abi: getters,
            functionName,
          });
          check(
            `${name}.${functionName}`,
            typeof expected === "boolean"
              ? actual === expected
              : same(actual, expected),
          );
        } catch {
          check(`${name}.${functionName}`, false);
        }
      }
      if (env.NEXT_PUBLIC_RPC_URL && env.NEXT_PUBLIC_RPC_URL !== rpc) {
        try {
          const webClient = createPublicClient({
            transport: http(env.NEXT_PUBLIC_RPC_URL, {
              timeout: 10000,
              retryCount: 0,
            }),
          });
          check(
            "Web RPC chain 43113",
            (await webClient.getChainId()) === 43113,
          );
        } catch {
          check("Web RPC chain 43113", false);
        }
      }
    }
  }
  return {
    timestamp: new Date().toISOString(),
    network: "Avalanche Fuji",
    mode: inspectContracts ? "deployed" : "before-deploy",
    checks,
    ready: checks.every((c) => c.pass),
  };
}

if (
  process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
) {
  const args = process.argv.slice(2);
  const file = args.find((arg) => arg !== "--deployed");
  try {
    if (file) process.loadEnvFile(path.resolve(file));
    const report = await runFujiPreflight(process.env, {
      deployed: args.includes("--deployed"),
    });
    console.log(JSON.stringify(report, null, 2));
    if (!report.ready) process.exitCode = 1;
  } catch {
    console.error(
      "Could not load Fuji configuration; check the env file path and format.",
    );
    process.exitCode = 1;
  }
}
