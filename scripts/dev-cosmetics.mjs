#!/usr/bin/env node
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../web/package.json", import.meta.url));
const {
  createPublicClient,
  createWalletClient,
  http,
  parseEther,
} = require("viem");
const { anvil } = require("viem/chains");

function artifact(name) {
  const { abi, bytecode } = JSON.parse(
    readFileSync(
      new URL(`../contracts/out/${name}.sol/${name}.json`, import.meta.url),
      "utf8",
    ),
  );
  return { abi, bytecode: bytecode.object };
}

async function main() {
  const port = Number(process.argv[2] ?? 8545);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw Error("Cổng Anvil không hợp lệ.");
  const url = `http://127.0.0.1:${port}`;
  const options = { chain: anvil, transport: http(url), pollingInterval: 100 };
  const rpc = createPublicClient(options);
  if ((await rpc.getChainId()) !== anvil.id)
    throw Error("Cần Anvil cục bộ (31337).");
  await rpc.request({ method: "anvil_nodeInfo" });
  const wallet = createWalletClient(options);
  const [owner, reviewer, white, black, relay] = await wallet.getAddresses();
  if (!relay) throw Error("Anvil cần ít nhất 5 tài khoản mở khóa.");

  async function confirmed(hash) {
    const receipt = await rpc.waitForTransactionReceipt({ hash: await hash });
    if (receipt.status !== "success")
      throw Error("Giao dịch demo bị hoàn tác.");
    return receipt;
  }

  async function deploy(name, args) {
    const code = artifact(name);
    const { contractAddress: address } = await confirmed(
      wallet.deployContract({ ...code, args, account: owner }),
    );
    if (!address) throw Error(`Không tìm thấy địa chỉ ${name}.`);
    return { abi: code.abi, address };
  }

  function write(contract, account, functionName, args, value) {
    return confirmed(
      wallet.writeContract({ ...contract, account, functionName, args, value }),
    );
  }

  const pool = await deploy("TournamentPrizePool", [relay]);
  const skins = await deploy("AvaClashCosmetics", [pool.address, owner]);
  const market = await deploy("CosmeticAuction", [
    skins.address,
    60n,
    604800n,
    15n,
    60n,
  ]);
  const { timestamp } = await rpc.getBlock();
  await write(pool, owner, "createTournament", [
    "Cúp AvaClash",
    "Giải thử nghiệm hai kỳ thủ, 5+0.",
    2,
    reviewer,
    timestamp + 86400n,
    timestamp + 259200n,
    3600n,
  ]);
  await write(skins, owner, "setOfficial", [
    0n,
    0,
    {
      light: 0xe8f3ea,
      dark: 0x53776e,
      lastLight: 0xffe48a,
      lastDark: 0xcbb158,
      whiteFill: 0,
      whiteStroke: 0,
      whiteWidth: 0,
      blackFill: 0,
      blackStroke: 0,
      blackWidth: 0,
      shadow: false,
    },
    "Bàn Ngọc",
  ]);
  await write(pool, owner, "fund", [0n], parseEther("0.001"));
  await write(pool, white, "register", [0n]);
  await write(pool, black, "register", [0n]);
  await write(pool, owner, "start", [0n]);
  await write(pool, reviewer, "review", [0n, 2, "0x" + "11".repeat(32)]);
  const { reviewUntil } = await rpc.readContract({
    ...pool,
    functionName: "getTournament",
    args: [0n],
  });
  await rpc.request({
    method: "evm_setNextBlockTimestamp",
    params: [`0x${reviewUntil.toString(16)}`],
  });
  await write(pool, owner, "finalize", [0n]);

  console.log(
    [
      "NEXT_PUBLIC_CHAIN_ID=31337",
      `NEXT_PUBLIC_RPC_URL=${url}`,
      `NEXT_PUBLIC_TOURNAMENT_ADDRESS=${pool.address}`,
      `NEXT_PUBLIC_COSMETICS_ADDRESS=${skins.address}`,
      `NEXT_PUBLIC_AUCTION_ADDRESS=${market.address}`,
      `Ví đồng hạng nhất có thể nhận skin #0: ${white}, ${black}`,
    ].join("\n"),
  );
}

main().catch((error) => {
  console.error(error.shortMessage ?? error.message);
  process.exitCode = 1;
});
