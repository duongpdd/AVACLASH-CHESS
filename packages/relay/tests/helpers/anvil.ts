import { spawn, execSync, ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  createPublicClient,
  createWalletClient,
  http,
  type PublicClient,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { localhost } from "viem/chains";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function isAnvilAvailable(): boolean {
  try {
    execSync("anvil --version", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export interface AnvilInstance {
  port: number;
  rpcUrl: string;
  process: ChildProcess;
  publicClient: PublicClient;
  stop: () => void;
}

export async function startAnvil(
  port = 8545 + Math.floor(Math.random() * 500),
): Promise<AnvilInstance> {
  if (!isAnvilAvailable()) {
    throw new Error("Anvil binary is not available in PATH.");
  }

  // An unread pipe can fill during a long campaign and block Anvil's RPC worker.
  const anvilProc = spawn(
    "anvil",
    ["--port", port.toString(), "--chain-id", "31337", "--quiet"],
    { stdio: "ignore", windowsHide: true },
  );

  const rpcUrl = `http://127.0.0.1:${port}`;
  const publicClient = createPublicClient({
    chain: {
      ...localhost,
      id: 31337,
      rpcUrls: {
        default: { http: [rpcUrl] },
      },
    },
    transport: http(),
    pollingInterval: 50,
  });

  // Wait for anvil to be responsive
  let ready = false;
  const start = Date.now();
  while (Date.now() - start < 20000) {
    try {
      await publicClient.getBlockNumber();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  if (!ready) {
    stopProcess(anvilProc);
    throw new Error(`Anvil failed to start within 20s on port ${port}`);
  }

  return {
    port,
    rpcUrl,
    process: anvilProc,
    publicClient,
    stop: () => stopProcess(anvilProc),
  };
}

function stopProcess(proc: ChildProcess) {
  try {
    if (process.platform === "win32" && proc.pid) {
      execSync(`taskkill /pid ${proc.pid} /f /t`, { stdio: "ignore" });
    } else {
      proc.kill("SIGKILL");
    }
  } catch {}
}

export const ANVIL_ACCOUNTS = [
  {
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address,
    privateKey:
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex,
  },
  {
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address,
    privateKey:
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex,
  },
  {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address,
    privateKey:
      "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a" as Hex,
  },
  {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address,
    privateKey:
      "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6" as Hex,
  },
  {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" as Address,
    privateKey:
      "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a" as Hex,
  },
  {
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc" as Address,
    privateKey:
      "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba" as Hex,
  },
  {
    address: "0x976EA74026E726554dB657fA54763abd0C3a0aa9" as Address,
    privateKey:
      "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e" as Hex,
  },
];

export async function deployContractsOnAnvil(anvil: AnvilInstance) {
  const metaArtifactPath = path.resolve(
    __dirname,
    "../../../../contracts/out/AvaClashMeta.sol/AvaClashMeta.json",
  );
  const escrowArtifactPath = path.resolve(
    __dirname,
    "../../../../contracts/out/ChessEscrow.sol/ChessEscrow.json",
  );

  const metaArtifact = JSON.parse(fs.readFileSync(metaArtifactPath, "utf-8"));
  const escrowArtifact = JSON.parse(
    fs.readFileSync(escrowArtifactPath, "utf-8"),
  );

  const deployerAccount = privateKeyToAccount(ANVIL_ACCOUNTS[0].privateKey);
  const relayAccount = privateKeyToAccount(ANVIL_ACCOUNTS[1].privateKey);
  const arbiterAccount = privateKeyToAccount(ANVIL_ACCOUNTS[2].privateKey);
  const treasuryAccount = privateKeyToAccount(ANVIL_ACCOUNTS[3].privateKey);

  const walletClient = createWalletClient({
    account: deployerAccount,
    chain: {
      ...localhost,
      id: 31337,
      rpcUrls: { default: { http: [anvil.rpcUrl] } },
    },
    transport: http(),
  });

  // 1. Deploy AvaClashMeta
  const metaHash = await walletClient.deployContract({
    abi: metaArtifact.abi,
    bytecode: metaArtifact.bytecode.object as Hex,
    args: [],
  });
  const metaReceipt = await anvil.publicClient.waitForTransactionReceipt({
    hash: metaHash,
  });
  if (metaReceipt.status !== "success")
    throw new Error("Meta deployment reverted");
  const metaAddress = metaReceipt.contractAddress!;

  // 2. Deploy ChessEscrow
  const escrowHash = await walletClient.deployContract({
    abi: escrowArtifact.abi,
    bytecode: escrowArtifact.bytecode.object as Hex,
    args: [
      relayAccount.address,
      arbiterAccount.address,
      treasuryAccount.address,
    ],
  });
  const escrowReceipt = await anvil.publicClient.waitForTransactionReceipt({
    hash: escrowHash,
  });
  if (escrowReceipt.status !== "success")
    throw new Error("Escrow deployment reverted");
  const escrowAddress = escrowReceipt.contractAddress!;

  // 3. Link contracts
  const setEscrowHash = await walletClient.writeContract({
    address: metaAddress,
    abi: metaArtifact.abi,
    functionName: "setEscrowContract",
    args: [escrowAddress],
  });
  const setEscrowReceipt = await anvil.publicClient.waitForTransactionReceipt({
    hash: setEscrowHash,
  });
  if (setEscrowReceipt.status !== "success")
    throw new Error("setEscrowContract reverted");

  const setMetaHash = await walletClient.writeContract({
    address: escrowAddress,
    abi: escrowArtifact.abi,
    functionName: "setMetaContract",
    args: [metaAddress],
  });
  const setMetaReceipt = await anvil.publicClient.waitForTransactionReceipt({
    hash: setMetaHash,
  });
  if (setMetaReceipt.status !== "success")
    throw new Error("setMetaContract reverted");

  return {
    metaAddress,
    escrowAddress,
    metaAbi: metaArtifact.abi,
    escrowAbi: escrowArtifact.abi,
    deployerAccount,
    relayAccount,
    arbiterAccount,
    treasuryAccount,
  };
}
