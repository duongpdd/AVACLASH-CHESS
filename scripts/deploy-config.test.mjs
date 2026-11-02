import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  validatePublicDeployment,
  validateFujiRoles,
  publicUrl,
} from "./deploy-config.mjs";
import { runFujiPreflight } from "./fuji-preflight.mjs";
import { makeDeploymentEnv } from "./deployment-env.mjs";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const { parseEther } = require("viem");
const address = (n) => `0x${String(n).repeat(40)}`;
const config = {
  NEXT_PUBLIC_CHAIN_ID: "43113",
  NEXT_PUBLIC_RPC_URL: "https://api.avax-test.network/ext/bc/C/rpc",
  NEXT_PUBLIC_ESCROW_ADDRESS: address(1),
  NEXT_PUBLIC_META_ADDRESS: address(2),
  NEXT_PUBLIC_RELAY_URL: "wss://relay.avaclash.dev",
  NEXT_PUBLIC_UI_MAX_STAKE: "0.1",
  DEPLOYER_ADDRESS: address(3),
  RELAY_SIGNER_ADDRESS: address(4),
  ARBITER_ADDRESS: address(5),
  TREASURY_ADDRESS: address(6),
};

test("public configuration rejects Anvil, missing contracts, insecure/private endpoints and invalid stakes", () => {
  assert.deepEqual(validatePublicDeployment(config), []);
  for (const [key, value] of [
    ["NEXT_PUBLIC_CHAIN_ID", "31337"],
    ["NEXT_PUBLIC_ESCROW_ADDRESS", address(0)],
    ["NEXT_PUBLIC_META_ADDRESS", address(1)],
    ["NEXT_PUBLIC_RELAY_URL", "ws://relay.avaclash.dev"],
    ["NEXT_PUBLIC_RELAY_URL", "wss://127.0.0.1"],
    ["NEXT_PUBLIC_RPC_URL", "https://user:password@rpc.avaclash.dev"],
    ["NEXT_PUBLIC_RPC_URL", "https://rpc.example.com"],
    ["NEXT_PUBLIC_UI_MAX_STAKE", "0.001"],
    ["NEXT_PUBLIC_UI_MAX_STAKE", "1.1"],
  ])
    assert.ok(
      validatePublicDeployment({ ...config, [key]: value }).length,
      key,
    );
  assert.ok(validatePublicDeployment({}).length);
  for (const url of [
    "https://localhost",
    "https://localhost.",
    "https://[::1]",
    "https://10.0.0.1",
    "https://relay.internal",
    "https://relay.local",
  ])
    assert.equal(publicUrl(url, "https:"), null);
  assert.equal(
    publicUrl("https://chess.vercel.app/", "https:", { originOnly: true }),
    null,
  );
  assert.ok(
    publicUrl("https://chess.vercel.app", "https:", { originOnly: true }),
  );
});

test("role validation rejects zero and duplicate accounts", () => {
  assert.deepEqual(validateFujiRoles(config), []);
  assert.ok(
    validateFujiRoles({ ...config, TREASURY_ADDRESS: config.ARBITER_ADDRESS })
      .length,
  );
  assert.ok(
    validateFujiRoles({ ...config, DEPLOYER_ADDRESS: address(0) }).length,
  );
});

test("Railway environment preserves the funded signer setup without copying secrets to generated files", () => {
  const env = {
    ...config,
    WEB_ORIGIN: "https://chess.vercel.app",
    RELAY_PRIVATE_KEY: "secret-fixture-do-not-copy",
  };
  const files = makeDeploymentEnv(env, "railway");
  assert.match(files.relay, /^RELAY_PRIVATE_KEY=$/m);
  assert.match(files.relay, /^RAILWAY_RUN_UID=0$/m);
  assert.match(files.relay, /^RESULTS_DIR=\/data\/results$/m);
  assert.doesNotMatch(files.relay + files.web, /secret-fixture-do-not-copy/);
  assert.doesNotMatch(files.web, /RELAY_PRIVATE_KEY/);
  assert.doesNotMatch(files.relay, /RELAY_DOMAIN/);
  assert.match(
    makeDeploymentEnv(env, "caddy").relay,
    /^RELAY_DOMAIN=relay.avaclash.dev$/m,
  );
  assert.throws(() =>
    makeDeploymentEnv(
      { ...env, WEB_ORIGIN: "http://localhost:3000" },
      "railway",
    ),
  );
  assert.throws(() =>
    makeDeploymentEnv(
      { ...env, NEXT_PUBLIC_RELAY_URL: "wss://relay.avaclash.dev/something" },
      "railway",
    ),
  );
});

test("Render environment uses PostgreSQL without exporting database credentials or wallet secrets", () => {
  const files = makeDeploymentEnv(
    {
      ...config,
      WEB_ORIGIN: "https://avaclash-chess.vercel.app",
      DATABASE_URL: "secret-database-fixture",
      RELAY_PRIVATE_KEY: "secret-wallet-fixture",
    },
    "render",
  );
  assert.match(files.relay, /^STORAGE_DRIVER=postgres$/m);
  assert.match(files.relay, /^DATABASE_URL=$/m);
  assert.match(files.relay, /^RELAY_PRIVATE_KEY=$/m);
  assert.match(files.relay, /^PORT=10000$/m);
  assert.doesNotMatch(
    files.relay,
    /RESULTS_DIR|ACTIVE_DIR|RELAY_DOMAIN|RAILWAY_RUN_UID/,
  );
  assert.doesNotMatch(files.web, /DATABASE_URL|PRIVATE_KEY/);
  assert.doesNotMatch(
    files.web + files.relay,
    /secret-database-fixture|secret-wallet-fixture/,
  );
});

function mockClient() {
  const values = {
    relaySigner: address(4),
    arbiter: address(5),
    treasury: address(6),
    owner: address(3),
    metaContract: address(2),
    escrowContract: address(1),
    singleSignedEnabled: false,
    spectatorBettingEnabled: false,
  };
  return {
    getChainId: async () => 43113,
    getBalance: async () => parseEther("1"),
    getCode: async () => "0x6000",
    readContract: async ({ functionName }) => values[functionName],
  };
}

test("deployed preflight requires both contracts, correct roles, links and disabled risky modes", async () => {
  assert.equal(
    (await runFujiPreflight(config, { deployed: true, client: mockClient() }))
      .ready,
    true,
  );
  for (const failure of [
    "chain",
    "balance",
    "code",
    "link",
    "signer",
    "mode",
    "rpc",
  ]) {
    const client = mockClient();
    if (failure === "chain") client.getChainId = async () => 31337;
    if (failure === "balance") client.getBalance = async () => 0n;
    if (failure === "code") client.getCode = async () => "0x";
    if (failure === "rpc")
      client.getChainId = async () => {
        throw Error("offline");
      };
    const read = client.readContract;
    if (["link", "signer", "mode"].includes(failure))
      client.readContract = async (args) => {
        if (failure === "link" && args.functionName === "metaContract")
          return address(9);
        if (failure === "signer" && args.functionName === "relaySigner")
          return address(9);
        if (
          failure === "mode" &&
          args.functionName === "spectatorBettingEnabled"
        )
          return true;
        return read(args);
      };
    assert.equal(
      (await runFujiPreflight(config, { deployed: true, client })).ready,
      false,
      failure,
    );
  }
  const missing = { ...config };
  delete missing.NEXT_PUBLIC_META_ADDRESS;
  assert.equal(
    (await runFujiPreflight(missing, { deployed: true, client: mockClient() }))
      .ready,
    false,
  );
});

test("Vercel build stops before compiling when online configuration is absent", () => {
  const env = { ...process.env };
  for (const key of Object.keys(config)) delete env[key];
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL("../web/scripts/build-vercel.mjs", import.meta.url),
      ),
    ],
    { env, encoding: "utf8", windowsHide: true },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /configuration is incomplete/);
  assert.doesNotMatch(result.stdout, /Creating an optimized production build/);
});
