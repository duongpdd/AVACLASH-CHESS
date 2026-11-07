import { afterAll, beforeAll, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import WebSocket from "ws";
import { createWalletClient, http, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  RelayClient,
  buildResultTypedData,
  type RelayClientEventMap,
  type ResultProposalMessage,
  type ResultSignatureMessage,
} from "@avaclash/shared";
import { RelayServer } from "../src/RelayServer.js";
import {
  startAnvil,
  deployContractsOnAnvil,
  ANVIL_ACCOUNTS,
  type AnvilInstance,
} from "./helpers/anvil.js";

let anvil: AnvilInstance;
let server: RelayServer;
let deployed: Awaited<ReturnType<typeof deployContractsOnAnvil>>;
let directory: string;
let url: string;
const clients: RelayClient[] = [];
const accounts = [4, 5].map((i) =>
  privateKeyToAccount(ANVIL_ACCOUNTS[i]!.privateKey),
);
const latencies: number[] = [];
const records: object[] = [];

function event<K extends keyof RelayClientEventMap>(
  client: RelayClient,
  name: K,
  predicate: (data: Parameters<RelayClientEventMap[K]>[0]) => boolean = () =>
    true,
): Promise<Parameters<RelayClientEventMap[K]>[0]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      off();
      reject(Error(`Timed out: ${name}`));
    }, 8000);
    const off = client.on(name, ((
      data: Parameters<RelayClientEventMap[K]>[0],
    ) => {
      if (!predicate(data)) return;
      clearTimeout(timer);
      off();
      resolve(data);
    }) as RelayClientEventMap[K]);
  });
}
function client(index: number) {
  const account = accounts[index]!;
  const c = new RelayClient({
    url,
    WebSocketImpl: WebSocket,
    chainId: 31337,
    escrowAddress: deployed.escrowAddress,
    origin: "",
    getAddress: () => account.address,
    signTypedData: (data) => account.signTypedData(data),
  });
  clients.push(c);
  return c;
}
beforeAll(async () => {
  anvil = await startAnvil();
  deployed = await deployContractsOnAnvil(anvil);
  directory = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-campaign-"));
  server = new RelayServer({
    port: 0,
    chainId: 31337,
    relayPrivateKey: ANVIL_ACCOUNTS[1]!.privateKey,
    contractAddress: deployed.escrowAddress,
    publicClient: anvil.publicClient,
    rpcUrl: anvil.rpcUrl,
    allowNoOrigin: true,
    resultsDir: directory,
  });
  await new Promise<void>((resolve) => server.wss.once("listening", resolve));
  const address = server.wss.address();
  if (!address || typeof address === "string")
    throw Error("Missing relay port");
  url = `ws://127.0.0.1:${address.port}`;
}, 45000);
afterAll(async () => {
  clients.forEach((c) => c.disconnect());
  await server?.close();
  anvil?.stop();
  if (directory) fs.rmSync(directory, { recursive: true, force: true });
});

it("settles and withdraws 20 isolated two-wallet games with real WebSockets, receipts, balances and reconnect", async () => {
  const chain = {
    id: 31337,
    name: "Anvil campaign",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [anvil.rpcUrl] } },
  } as const;
  const wallets = accounts.map((account) =>
    createWalletClient({ account, chain, transport: http(anvil.rpcUrl) }),
  );
  const abi = deployed.escrowAbi;
  async function transaction(
    index: number,
    functionName: string,
    args: readonly unknown[] = [],
    value?: bigint,
  ) {
    const nonce = await anvil.publicClient.getTransactionCount({
      address: accounts[index]!.address,
      blockTag: "pending",
    });
    const hash = await wallets[index]!.writeContract({
      address: deployed.escrowAddress,
      abi,
      functionName,
      args,
      value,
      nonce,
    });
    const receipt = await anvil.publicClient
      .waitForTransactionReceipt({ hash, timeout: 15000, pollingInterval: 50 })
      .catch(async (error) => {
        console.error(
          "Campaign receipt failure",
          functionName,
          index,
          nonce,
          await anvil.publicClient.getTransaction({ hash }),
          await anvil.publicClient.getTransactionCount({
            address: accounts[index]!.address,
            blockTag: "pending",
          }),
        );
        throw error;
      });
    expect(receipt.status).toBe("success");
    return { hash, gas: receipt.gasUsed.toString(), receipt };
  }
  for (let i = 0; i < 20; i++) {
    const creatorWhite = i % 2 === 0;
    const roomId = Number(
      await anvil.publicClient.readContract({
        address: deployed.escrowAddress,
        abi,
        functionName: "nextRoomId",
      }),
    );
    const create = await transaction(
      0,
      "createRoom",
      [creatorWhite],
      parseEther("0.01"),
    );
    const join = await transaction(
      1,
      "joinRoom",
      [BigInt(roomId)],
      parseEther("0.01"),
    );
    const seats = [client(0), client(1)];
    const ready = seats.map((c) =>
      event(c, "roomState", (s) => s.status === "active"),
    );
    seats.forEach((c) => c.connect(roomId));
    await Promise.all(ready);
    const white = creatorWhite ? 0 : 1;
    const black = 1 - white;
    const observer = seats[0]!;
    const proposalPromise = event(observer, "resultProposal");
    const signaturePromise = event(observer, "resultSignature");
    const mode = i % 3;
    const moves =
      mode === 0
        ? ["f2f3", "e7e5", "g2g4", "d8h4"]
        : ["e2e4", "e7e5", "g1f3", "b8c6", "f1b5", "a7a6"];
    for (let n = 0; n < moves.length; n++) {
      const mover = n % 2 === 0 ? white : black;
      const received = event(
        seats[1 - mover]!,
        "move",
        (m) => m.uci === moves[n],
      );
      const echo = event(seats[mover]!, "move", (m) => m.uci === moves[n]);
      const began = performance.now();
      seats[mover]!.sendMove(moves[n]!);
      await Promise.all([received, echo]);
      latencies.push(performance.now() - began);
      if (i === 1 && n === 1) {
        seats[1]!.disconnect();
        seats[1] = client(1);
        const resumed = event(
          seats[1]!,
          "roomState",
          (s) => s.status === "active",
        );
        seats[1]!.connect(roomId);
        const state = await resumed;
        expect(state.moves).toEqual(moves.slice(0, n + 1));
      }
    }
    if (mode === 1) {
      const offer = event(seats[black]!, "drawOffer");
      seats[white]!.sendDrawOffer();
      await offer;
      seats[black]!.sendDrawAccept();
    } else if (mode === 2) seats[white]!.sendResign();
    const [proposal, signature]: [
      ResultProposalMessage,
      ResultSignatureMessage,
    ] = await Promise.all([proposalPromise, signaturePromise]).catch(
      async (error) => {
        console.error(
          "Campaign RPC state",
          await anvil.publicClient.getBlockNumber({ cacheTime: 0 }),
          await anvil.publicClient.getTransactionCount({
            address: deployed.relayAccount.address,
            blockTag: "pending",
          }),
          await anvil.publicClient.getTransactionCount({
            address: deployed.relayAccount.address,
            blockTag: "latest",
          }),
          await anvil.publicClient.request({
            method: "txpool_content" as never,
          }),
        );
        throw error;
      },
    );
    const signerIndex = proposal.outcome === 2 ? 0 : black;
    const typed = buildResultTypedData(
      deployed.escrowAddress,
      {
        ...proposal,
        matchId: BigInt(roomId),
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      31337,
    );
    const playerSig = await accounts[signerIndex]!.signTypedData(typed);
    const settle = await transaction(signerIndex, "submitResult", [
      BigInt(roomId),
      proposal.winner,
      proposal.outcome,
      proposal.reason,
      proposal.moveCount,
      proposal.movesHash,
      BigInt(proposal.nonce),
      BigInt(proposal.deadline),
      playerSig,
      signature.signature,
    ]);
    const room = (await anvil.publicClient.readContract({
      address: deployed.escrowAddress,
      abi,
      functionName: "getRoom",
      args: [BigInt(roomId)],
    })) as { status: number };
    expect(Number(room.status)).toBe(2);
    const withdrawals = [];
    for (let wallet = 0; wallet < 2; wallet++) {
      const pending = (await anvil.publicClient.readContract({
        address: deployed.escrowAddress,
        abi,
        functionName: "pendingWithdrawals",
        args: [accounts[wallet]!.address],
      })) as bigint;
      expect(pending).toBe(
        proposal.outcome === 2
          ? parseEther("0.01")
          : wallet === black
            ? parseEther("0.019")
            : 0n,
      );
      if (!pending) continue;
      const before = await anvil.publicClient.getBalance({
        address: accounts[wallet]!.address,
      });
      const withdraw = await transaction(wallet, "withdraw");
      const after = await anvil.publicClient.getBalance({
        address: accounts[wallet]!.address,
      });
      expect(after).toBe(
        before +
          pending -
          withdraw.receipt.gasUsed * withdraw.receipt.effectiveGasPrice,
      );
      withdrawals.push({
        hash: withdraw.hash,
        gas: withdraw.gas,
        payoutWei: pending.toString(),
      });
    }
    records.push({
      roomId,
      creatorWhite,
      outcome: proposal.outcome,
      reason: proposal.reason,
      moves,
      create: { hash: create.hash, gas: create.gas },
      join: { hash: join.hash, gas: join.gas },
      settle: { hash: settle.hash, gas: settle.gas },
      withdrawals,
    });
    seats.forEach((c) => c.disconnect());
    console.log(`[Campaign] ${i + 1}/20 games settled and withdrawn`);
  }
  const sorted = [...latencies].sort((a, b) => a - b);
  const output = path.resolve("../../docs/benchmarks/local-campaign.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(
    output,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        environment:
          "isolated Anvil, Node WebSocket clients on one Windows host; no browser or Fuji",
        chainId: 31337,
        escrow: deployed.escrowAddress,
        games: records.length,
        relayLatency: {
          samples: sorted.length,
          p50Ms: sorted[Math.ceil(sorted.length * 0.5) - 1],
          p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
        },
        records,
      },
      null,
      2,
    ),
  );
  expect(records).toHaveLength(20);
}, 300000);
