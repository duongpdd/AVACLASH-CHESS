import { afterEach, describe, expect, it, vi } from "vitest";
import crypto from "node:crypto";
import type { WebSocket } from "ws";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  buildBoundJoinTypedData,
  buildResultTypedData,
} from "@avaclash/shared";
import { recoverTypedDataAddress } from "viem";
import { PostgresStore } from "../src/PostgresStore.js";
import { RelayRoom } from "../src/RelayRoom.js";
import {
  RelayServer,
  type ActiveGameState,
  type SavedGameResult,
} from "../src/RelayServer.js";

const white = privateKeyToAccount(generatePrivateKey());
const black = privateKeyToAccount(generatePrivateKey());
const contract = `0x${crypto.randomBytes(20).toString("hex")}` as const;
const rooms: RelayRoom[] = [];
const stores: PostgresStore[] = [];
const servers: RelayServer[] = [];
function socket() {
  const messages: any[] = [];
  return {
    messages,
    ws: {
      readyState: 1,
      send: (s: string) => messages.push(JSON.parse(s)),
      close: vi.fn(),
    } as unknown as WebSocket,
  };
}
afterEach(async () => {
  rooms.splice(0).forEach((r) => r.destroy());
  await Promise.all(servers.splice(0).map((s) => s.close()));
  await Promise.all(stores.splice(0).map((s) => s.close()));
}, 45_000);

describe("Durable room acknowledgements", () => {
  it("does not write an active snapshot when a queued reconnect runs after terminal commit", async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const commit = vi.fn(() => pending);
    const a = socket(),
      b = socket();
    const room = new RelayRoom({
      roomId: 3,
      whiteAddress: white.address,
      blackAddress: black.address,
      commit,
    });
    rooms.push(room);
    room.whitePlayer = {
      address: white.address,
      ws: a.ws,
      color: "w",
      warnings: 0,
    };
    room.blackPlayer = {
      address: black.address,
      ws: b.ws,
      color: "b",
      warnings: 0,
    };
    room.status = "active";
    room.lastClockUpdate = Date.now();
    const terminal = room.run(() => room.handleResign(a.ws));
    await Promise.resolve();
    await Promise.resolve();
    const reconnect = room.run(() => room.broadcastRoomState(), true);
    finish();
    await terminal;
    await reconnect;
    expect(commit).toHaveBeenCalledTimes(1);
    expect(room.status).toBe("finished");
  });

  it("withholds the move and clock broadcast until commit; serializes the next move", async () => {
    let finish!: () => void;
    const first = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const commit = vi
      .fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValue(undefined);
    const a = socket(),
      b = socket();
    const room = new RelayRoom({
      roomId: 1,
      whiteAddress: white.address,
      blackAddress: black.address,
      commit,
    });
    rooms.push(room);
    room.whitePlayer = {
      address: white.address,
      ws: a.ws,
      color: "w",
      warnings: 0,
    };
    room.blackPlayer = {
      address: black.address,
      ws: b.ws,
      color: "b",
      warnings: 0,
    };
    room.status = "active";
    room.lastClockUpdate = Date.now();
    const move1 = room.run(() => room.handleMove(a.ws, 0, "e2e4"));
    await Promise.resolve();
    await Promise.resolve();
    const move2 = room.run(() => room.handleMove(b.ws, 1, "e7e5"));
    expect(a.messages).toEqual([]);
    expect(room.moves).toEqual(["e2e4"]);
    finish();
    expect(await move1).toBe(true);
    expect(await move2).toBe(true);
    expect(
      a.messages.filter((m) => m.type === "move").map((m) => m.uci),
    ).toEqual(["e2e4", "e7e5"]);
    expect(commit).toHaveBeenCalledTimes(2);
  });

  it("does not acknowledge or invoke terminal signing when persistence fails", async () => {
    const a = socket(),
      b = socket();
    const onGameOver = vi.fn();
    const room = new RelayRoom({
      roomId: 2,
      whiteAddress: white.address,
      blackAddress: black.address,
      commit: async () => {
        throw Error("database unavailable");
      },
      onGameOver,
    });
    rooms.push(room);
    room.whitePlayer = {
      address: white.address,
      ws: a.ws,
      color: "w",
      warnings: 0,
    };
    room.blackPlayer = {
      address: black.address,
      ws: b.ws,
      color: "b",
      warnings: 0,
    };
    room.status = "active";
    room.lastClockUpdate = Date.now();
    await expect(room.run(() => room.handleResign(a.ws))).rejects.toThrow(
      "Could not save",
    );
    expect(a.messages).toEqual([]);
    expect(onGameOver).not.toHaveBeenCalled();
    expect(a.ws.close).toHaveBeenCalled();
    await expect(
      room.run(() => room.handleMove(a.ws, 0, "e2e4")),
    ).rejects.toThrow("unavailable");
  });
});

// Uses an isolated Neon validation branch. Production never supplies TEST_DATABASE_URL.
describe.runIf(!!process.env.TEST_DATABASE_URL)(
  "Real PostgreSQL recovery and fencing",
  { timeout: 45_000 },
  () => {
    function store() {
      const instance = new PostgresStore(
        process.env.TEST_DATABASE_URL!,
        43113,
        contract,
      );
      stores.push(instance);
      return instance;
    }
    function active(roomId: number): ActiveGameState {
      return {
        chainId: 43113,
        contractAddress: contract,
        roomId,
        moves: ["e2e4"],
        whiteMs: 290000,
        blackMs: 300000,
        activeTurn: "b",
        whiteAddress: white.address,
        blackAddress: black.address,
        creatorIsWhite: true,
        status: "active",
        savedAt: Date.now(),
      };
    }
    function terminal(roomId: number): SavedGameResult {
      return {
        ...active(roomId),
        outcome: "white",
        reason: "resign",
        winner: white.address,
        timestamp: Date.now(),
      };
    }

    it("restores an active transcript after close/reopen and keeps terminal results immutable", async () => {
      const a = store();
      await a.check();
      await a.claim(10);
      await a.saveActive(active(10));
      await a.release(10);
      const b = store();
      const restored = await b.claim(10);
      expect(restored.active_state).toMatchObject({
        roomId: 10,
        moves: ["e2e4"],
        whiteMs: 290000,
        blackMs: 300000,
        activeTurn: "b",
      });
      await b.saveResult(terminal(10));
      const saved = await a.read(10);
      expect(saved?.active_state).toBeNull();
      expect(saved?.result?.winner).toBe(white.address);
      await expect(
        b.saveResult({
          ...terminal(10),
          outcome: "black",
          winner: black.address,
        }),
      ).rejects.toThrow("different terminal");
      expect((await a.claim(10)).result?.outcome).toBe("white");
      await expect(a.saveActive(active(10))).rejects.toThrow();
    });

    it("rejects a second owner and fences off a stale process after its lease expires", async () => {
      const a = store(),
        b = store();
      await a.claim(11);
      await (a as any).renew();
      await a.saveActive(active(11));
      await expect(b.claim(11)).rejects.toThrow("another relay");
      // Expire only this test's own lease to simulate a killed process; no sleeps or deletes.
      await a.pool.query(
        "UPDATE avaclash_relay_games SET lease_until=clock_timestamp()-interval '1 second' WHERE chain_id=$1 AND escrow_address=$2 AND room_id=$3",
        [43113, contract, 11],
      );
      await b.claim(11);
      await expect(
        a.saveActive({ ...active(11), moves: ["e2e4", "e7e5"] }),
      ).rejects.toThrow("durably save");
      await b.saveActive({ ...active(11), blackMs: 280000 });
      expect((await b.read(11))?.active_state?.moves).toEqual(["e2e4"]);
    });

    it("recovers through authenticated server joins and re-signs the same stored result after restart", async () => {
      const relayKey = generatePrivateKey();
      const publicClient = {
        readContract: vi.fn().mockResolvedValue({
          status: 1,
          playerA: white.address,
          playerB: black.address,
          creatorIsWhite: true,
          gameStarted: true,
        }),
      };
      const create = async () => {
        const s = new RelayServer({
          port: 0,
          databaseUrl: process.env.TEST_DATABASE_URL,
          chainId: 43113,
          contractAddress: contract,
          relayPrivateKey: relayKey,
          publicClient,
          signalGameStartedEnabled: false,
          allowNoOrigin: true,
          resultsDir: "./must-not-create-postgres-results",
        });
        servers.push(s);
        await s.initialize();
        return s;
      };
      const join = async (s: RelayServer, account: typeof white) => {
        const client = socket();
        const nonce = `0x${crypto.randomBytes(32).toString("hex")}` as const;
        const expiresAt = Math.floor(Date.now() / 1000) + 60;
        const session: any = {
          ip: "127.0.0.1",
          authChallenge: { nonce, expiresAt, used: false, origin: "" },
        };
        const signature = await account.signTypedData(
          buildBoundJoinTypedData(
            12,
            account.address,
            nonce,
            expiresAt,
            43113,
            { escrowAddress: contract, origin: "" },
          ),
        );
        await s.routeMessage(
          client.ws,
          {
            type: "join_room",
            roomId: 12,
            address: account.address,
            signature,
            nonce,
          },
          session,
        );
        return { ...client, session };
      };
      const original = await create();
      const a = await join(original, white);
      await join(original, black);
      await original.routeMessage(
        a.ws,
        { type: "move", roomId: 12, seq: 0, uci: "e2e4" },
        a.session,
      );
      expect(a.messages.some((m) => m.type === "move")).toBe(true);
      // Simulate a stopped process without allowing shutdown to flush another snapshot.
      original.rooms.get(12)!.destroy();
      await original.store!.pool.query(
        "UPDATE avaclash_relay_games SET lease_until=clock_timestamp()-interval '1 second' WHERE chain_id=$1 AND escrow_address=$2 AND room_id=$3",
        [43113, contract, 12],
      );
      const restarted = await create();
      const b = await join(restarted, black);
      expect(restarted.rooms.get(12)?.moves).toEqual(["e2e4"]);
      expect(restarted.rooms.get(12)?.activeTurn).toBe("b");
      await original.close();
      servers.splice(servers.indexOf(original), 1);
      await restarted.routeMessage(
        b.ws,
        { type: "resign", roomId: 12 },
        b.session,
      );
      await vi.waitFor(() =>
        expect(b.messages.some((m) => m.type === "result_signature")).toBe(
          true,
        ),
      );
      await restarted.close();
      servers.splice(servers.indexOf(restarted), 1);
      const finished = await create();
      const player = await join(finished, white);
      expect(player.messages.some((m) => m.type === "game_finished")).toBe(
        true,
      );
      expect(finished.rooms.has(12)).toBe(false);
      await finished.routeMessage(
        player.ws,
        { type: "request_result", roomId: 12 },
        player.session,
      );
      const proposal = player.messages.find(
        (m) => m.type === "result_proposal",
      );
      const sig = player.messages.find((m) => m.type === "result_signature");
      expect(proposal.winner.toLowerCase()).toBe(white.address.toLowerCase());
      expect(
        await recoverTypedDataAddress({
          ...buildResultTypedData(
            contract,
            {
              ...proposal,
              matchId: 12n,
              nonce: BigInt(proposal.nonce),
              deadline: BigInt(proposal.deadline),
            },
            43113,
          ),
          signature: sig.signature,
        }),
      ).toBe(finished.relayAddress);
    });
  },
);
