import { afterAll, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";
import {
  createWalletClient,
  http,
  keccak256,
  parseEther,
  toHex,
  type Hex,
} from "viem";
import {
  generatePrivateKey,
  mnemonicToAccount,
  privateKeyToAccount,
} from "viem/accounts";
import {
  RelayClient,
  TOURNAMENT_ABI,
  type RelayClientEventMap,
} from "@avaclash/shared";
import { RelayServer } from "../src/RelayServer.js";
import {
  ANVIL_ACCOUNTS,
  isAnvilAvailable,
  startAnvil,
  type AnvilInstance,
} from "./helpers/anvil.js";

let anvil: AnvilInstance | undefined;
let relay: RelayServer | undefined;
let directory: string | undefined;
const clients = new Set<RelayClient>();
const artifactPath = fileURLToPath(
  new URL(
    "../../../contracts/out/TournamentPrizePool.sol/TournamentPrizePool.json",
    import.meta.url,
  ),
);

afterAll(async () => {
  for (const client of clients) client.disconnect();
  await relay?.close();
  anvil?.stop();
  if (directory) {
    const active = path.join(directory, "active");
    for (const folder of [active, directory]) {
      if (!fs.existsSync(folder)) continue;
      for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
        if (entry.isFile()) fs.unlinkSync(path.join(folder, entry.name));
      }
      fs.rmdirSync(folder);
    }
  }
});

function once<K extends keyof RelayClientEventMap>(
  client: RelayClient,
  event: K,
  accept: (value: Parameters<RelayClientEventMap[K]>[0]) => boolean = () =>
    true,
) {
  return new Promise<Parameters<RelayClientEventMap[K]>[0]>(
    (resolve, reject) => {
      const timer = setTimeout(() => {
        off();
        reject(Error(`Missing relay event: ${event}`));
      }, 8000);
      const off = client.on(event, ((
        value: Parameters<RelayClientEventMap[K]>[0],
      ) => {
        if (!accept(value)) return;
        clearTimeout(timer);
        off();
        resolve(value);
      }) as RelayClientEventMap[K]);
    },
  );
}

it.skipIf(!isAnvilAvailable() || !fs.existsSync(artifactPath))(
  "runs all 28 free games, checks relay signatures, resolves an appeal and pays an 8-player event",
  async () => {
    const chainProcess = await startAnvil();
    anvil = chainProcess;
    const { publicClient: rpc, rpcUrl } = chainProcess;
    const chain = {
      id: 31337,
      name: "Anvil",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: [rpcUrl] } },
    } as const;
    const organizer = privateKeyToAccount(ANVIL_ACCOUNTS[0]!.privateKey);
    const reviewer = privateKeyToAccount(generatePrivateKey());
    await rpc.request({
      method: "anvil_setBalance",
      params: [reviewer.address, toHex(parseEther("1"))],
    } as never);
    const relayAccount = ANVIL_ACCOUNTS[1]!;
    const players = Array.from({ length: 8 }, (_, i) =>
      mnemonicToAccount(
        "test test test test test test test test test test test junk",
        { addressIndex: i + 2 },
      ),
    );
    const wallet = (account: typeof organizer) =>
      createWalletClient({ account, chain, transport: http(rpcUrl) });
    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8")) as {
      bytecode: { object: Hex };
    };
    const deployed = await rpc.waitForTransactionReceipt({
      hash: await wallet(organizer).deployContract({
        abi: TOURNAMENT_ABI,
        bytecode: artifact.bytecode.object,
        args: [relayAccount.address],
      }),
    });
    expect(deployed.status).toBe("success");
    const address = deployed.contractAddress!;
    const receipt = async (hash: Promise<Hex>) => {
      const result = await rpc.waitForTransactionReceipt({ hash: await hash });
      if (result.status !== "success") {
        const tx = await rpc.getTransaction({ hash: result.transactionHash });
        throw Error(
          `Anvil transaction ${tx.input.slice(0, 10)} reverted (gas ${result.gasUsed}/${tx.gas})`,
        );
      }
      return result;
    };
    const config = { address, abi: TOURNAMENT_ABI } as const;
    const time = (await rpc.getBlock()).timestamp;
    await receipt(
      wallet(organizer).writeContract({
        ...config,
        functionName: "createTournament",
        args: [
          "Campus Cup",
          "5+0; review before claim.",
          8,
          reviewer.address,
          time + 86400n,
          time + 259200n,
          3600n,
        ],
      }),
    );
    const funding = parseEther("0.1");
    await receipt(
      wallet(organizer).writeContract({
        ...config,
        functionName: "fund",
        args: [0n],
        value: funding,
      }),
    );
    await Promise.all(
      players.map((player) =>
        receipt(
          wallet(player).writeContract({
            ...config,
            functionName: "register",
            args: [0n],
          }),
        ),
      ),
    );
    expect(await rpc.getBalance({ address })).toBe(funding);
    await receipt(
      wallet(organizer).writeContract({
        ...config,
        functionName: "start",
        args: [0n],
      }),
    );
    const rooms = await rpc.readContract({
      ...config,
      functionName: "getMatchViews",
      args: [0n],
    });
    expect(rooms).toHaveLength(28);
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "avaclash-tournament-"));
    const server = new RelayServer({
      port: 0,
      chainId: 31337,
      relayPrivateKey: relayAccount.privateKey,
      contractAddress: address,
      rpcUrl,
      publicClient: rpc,
      allowNoOrigin: true,
      resultsDir: directory,
      signalGameStartedEnabled: false,
      minRelayBalance: 0n,
    });
    relay = server;
    await new Promise<void>((resolve) => server.wss.once("listening", resolve));
    const listener = server.wss.address();
    if (!listener || typeof listener === "string")
      throw Error("Missing relay port");
    const url = `ws://127.0.0.1:${listener.port}`;
    const accountFor = (address: string) =>
      players.find((p) => p.address.toLowerCase() === address.toLowerCase())!;
    const decision = keccak256(toHex("Reviewer confirmed the played game"));
    for (const { roomId, white, black } of rooms) {
      const seats = [accountFor(white), accountFor(black)].map((account) => {
        const client = new RelayClient({
          url,
          chainId: 31337,
          escrowAddress: address,
          getAddress: () => account.address,
          signTypedData: (typedData) =>
            account.signTypedData(
              typedData as Parameters<typeof account.signTypedData>[0],
            ),
          WebSocketImpl: WebSocket as unknown as typeof globalThis.WebSocket,
        });
        clients.add(client);
        return client;
      });
      const ready = seats.map((client) =>
        once(client, "roomState", (state) => state.status === "active"),
      );
      seats.forEach((client) => client.connect(Number(roomId)));
      await Promise.all(ready);
      const proposal = once(seats[0]!, "resultProposal");
      const signature = once(seats[0]!, "resultSignature");
      const moves = ["f2f3", "e7e5", "g2g4", "d8h4"];
      for (let i = 0; i < moves.length; i++) {
        const echo = seats.map((c) =>
          once(c, "move", (move) => move.uci === moves[i]),
        );
        seats[i % 2]!.sendMove(moves[i]!);
        await Promise.all(echo);
      }
      const [r, sig] = await Promise.all([proposal, signature]);
      expect(r.outcome).toBe(1);
      expect(
        (await server.readTournamentReplay(Number(roomId)))?.moves,
      ).toEqual(moves);
      await receipt(
        wallet(accountFor(white)).writeContract({
          ...config,
          functionName: "reportResult",
          gas: 160_000n,
          args: [
            {
              ...r,
              matchId: roomId,
              winner: r.winner as Hex,
              movesHash: r.movesHash as Hex,
              deadline: BigInt(r.deadline),
              nonce: BigInt(r.nonce),
            },
            sig.signature as Hex,
          ],
        }),
      );
      await receipt(
        wallet(reviewer).writeContract({
          ...config,
          functionName: "review",
          gas: 160_000n,
          args: [roomId, r.outcome, decision],
        }),
      );
      seats.forEach((client) => {
        client.disconnect();
        clients.delete(client);
      });
    }
    const appellant = accountFor(rooms[0]!.white);
    await receipt(
      wallet(appellant).writeContract({
        ...config,
        functionName: "appeal",
        args: [0n, keccak256(toHex("appeal case 0"))],
      }),
    );
    await rpc.request({ method: "evm_increaseTime", params: [3601] } as never);
    await rpc.request({ method: "evm_mine", params: [] } as never);
    await expect(
      rpc.simulateContract({
        ...config,
        functionName: "finalize",
        args: [0n],
        account: organizer.address,
      }),
    ).rejects.toThrow();
    await receipt(
      wallet(reviewer).writeContract({
        ...config,
        functionName: "resolveAppeal",
        args: [0n, appellant.address, 1, decision],
      }),
    );
    await rpc.request({ method: "evm_increaseTime", params: [3601] } as never);
    await rpc.request({ method: "evm_mine", params: [] } as never);
    await receipt(
      wallet(organizer).writeContract({
        ...config,
        functionName: "finalize",
        args: [0n],
      }),
    );
    const [addresses] = await rpc.readContract({
      ...config,
      functionName: "standings",
      args: [0n],
    });
    const [awards] = await rpc.readContract({
      ...config,
      functionName: "getAllocation",
      args: [0n],
    });
    const total = awards.reduce((sum, award) => sum + award, 0n);
    expect(total).toBeGreaterThan(funding - 8n);
    expect(total).toBeLessThanOrEqual(funding);
    for (let i = 0; i < addresses.length; i++) {
      if (awards[i] === 0n) continue;
      const player = accountFor(addresses[i]!);
      await receipt(
        wallet(player).writeContract({
          ...config,
          functionName: "claim",
          args: [0n],
        }),
      );
      await expect(
        rpc.simulateContract({
          ...config,
          functionName: "claim",
          args: [0n],
          account: player.address,
        }),
      ).rejects.toThrow();
    }
    expect(
      (
        await rpc.readContract({
          ...config,
          functionName: "getTournament",
          args: [0n],
        })
      ).paid,
    ).toBe(total);
    expect(await rpc.getBalance({ address })).toBe(funding - total);
  },
  150_000,
);
