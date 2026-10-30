#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

console.log("========================================================================");
console.log("           AVACLASH CHESS — LOCAL DEVNET ORCHESTRATOR                   ");
console.log("========================================================================");
console.log("1. Starting local Anvil node (chainId: 31337, port: 8545)...");

const anvil = spawn("anvil", ["--port", "8545", "--chain-id", "31337"], {
  stdio: ["ignore", "pipe", "pipe"],
  shell: true,
});

let anvilStarted = false;

anvil.stdout.on("data", (data) => {
  const msg = data.toString();
  if (!anvilStarted && msg.includes("Listening on")) {
    anvilStarted = true;
    onAnvilReady();
  }
});

anvil.stderr.on("data", (data) => {
  const err = data.toString();
  if (err.includes("Address already in use")) {
    console.error("[Error] Port 8545 is already in use by another process.");
    process.exit(1);
  }
});

function cleanup() {
  console.log("\nStopping local Anvil node...");
  anvil.kill();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);

async function onAnvilReady() {
  console.log("   ✓ Anvil node is active on http://127.0.0.1:8545\n");
  console.log("2. Deploying contracts with Deploy.s.sol...");

  const contractsDir = path.join(rootDir, "contracts");

  // Anvil well-known addresses (public dev addresses):
  const deployer = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"; // Account 0
  const relaySigner = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Account 1
  const arbiter = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"; // Account 2
  const treasury = "0x90F79bf6EB2c4f870365E785982E1f101E93b906"; // Account 3

  const deployEnv = {
    ...process.env,
    RELAY_SIGNER_ADDRESS: relaySigner,
    ARBITER_ADDRESS: arbiter,
    TREASURY_ADDRESS: treasury,
  };

  const deployCmd = spawn(
    "forge",
    [
      "script",
      "script/Deploy.s.sol",
      "--rpc-url",
      "http://127.0.0.1:8545",
      "--broadcast",
      "--unlocked",
      "--sender",
      deployer,
    ],
    {
      cwd: contractsDir,
      env: deployEnv,
      shell: true,
    }
  );

  let deployOutput = "";

  deployCmd.stdout.on("data", (data) => {
    deployOutput += data.toString();
    process.stdout.write(data);
  });

  deployCmd.stderr.on("data", (data) => {
    process.stderr.write(data);
  });

  deployCmd.on("close", (code) => {
    if (code !== 0) {
      console.error(`\n[Deploy Error] Forge script exited with code ${code}`);
      cleanup();
      return;
    }

    // Extract deployed addresses
    const metaMatch = deployOutput.match(/AvaClashMeta deployed at:\s*(0x[a-fA-F0-9]{40})/);
    const escrowMatch = deployOutput.match(/ChessEscrow deployed at:\s*(0x[a-fA-F0-9]{40})/);

    if (!metaMatch || !escrowMatch) {
      console.error("\n[Error] Could not parse deployed contract addresses from forge output.");
      cleanup();
      return;
    }

    const metaAddress = metaMatch[1];
    const escrowAddress = escrowMatch[1];

    console.log("\n   ✓ Deployment Successful!");
    console.log(`     AvaClashMeta: ${metaAddress}`);
    console.log(`     ChessEscrow:  ${escrowAddress}\n`);

    console.log("3. Writing configuration to .env.local files...");

    // Write web/.env.local
    const webEnvContent = `# Local Anvil Development Configuration
NEXT_PUBLIC_ESCROW_ADDRESS=${escrowAddress}
NEXT_PUBLIC_META_ADDRESS=${metaAddress}
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RELAY_URL=ws://127.0.0.1:8080
`;
    fs.writeFileSync(path.join(rootDir, "web", ".env.local"), webEnvContent, "utf8");
    console.log("   ✓ Written to web/.env.local");

    // Write packages/relay/.env.local
    const relayEnvContent = `# Local Anvil Development Configuration
ESCROW_ADDRESS=${escrowAddress}
CHAIN_ID=31337
RPC_URL=http://127.0.0.1:8545
RELAY_PORT=8080
RELAY_SIGNER_ADDRESS=${relaySigner}
RELAY_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ALLOW_NO_ORIGIN=true
`;
    fs.writeFileSync(path.join(rootDir, "packages", "relay", ".env.local"), relayEnvContent, "utf8");
    console.log("   ✓ Written to packages/relay/.env.local\n");

    console.log("========================================================================");
    console.log("  ⚠️  CẢNH BÁO AN NINH TO LỚN / CRITICAL SECURITY WARNING  ⚠️            ");
    console.log("========================================================================");
    console.log("  CÁC TÀI KHOẢN VÀ KHÓA DƯỚI ĐÂY LÀ TÀI KHOẢN MẪU CÔNG KHAI CỦA ANVIL!   ");
    console.log("  TUYỆT ĐỐI KHÔNG BAO GIỜ SỬ DỤNG TRÊN MAINNET HOẶC NẠP TIỀN THẬT VÀO!  ");
    console.log("  CHỈ DÙNG DUY NHẤT CHO MẠNG LOCAL (CHAIN ID: 31337) TRONG QUÁ TRÌNH DEV. ");
    console.log("========================================================================");
    console.log("\nHướng dẫn nhập tài khoản Anvil vào ví (MetaMask / Rabby / Core):");
    console.log("- Network RPC: http://127.0.0.1:8545 | Chain ID: 31337 | Currency: ETH/AVAX");
    console.log("- Người chơi 1 (White): Nhập khóa bí mật của Anvil Account 4 (Địa chỉ: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65)");
    console.log("- Người chơi 2 (Black): Nhập khóa bí mật của Anvil Account 5 (Địa chỉ: 0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc)");
    console.log("\nAnvil đang chạy ở chế độ nền. Nhấn Ctrl+C để dừng.");
  });
}

