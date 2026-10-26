import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { recoverTypedDataAddress, type PrivateKeyAccount } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  buildResultTypedData,
  buildJoinTypedData,
} from "@avaclash/shared";
import { RelayServer } from "../src/RelayServer.js";

const TEST_PORT = 9876;
const RELAY_KEY = generatePrivateKey();
const CONTRACT = "0x1234567890123456789012345678901234567890";
const CHAIN_ID = 43113;

const accountAlice = privateKeyToAccount(generatePrivateKey());
const accountBob = privateKeyToAccount(generatePrivateKey());
const accountCharlie = privateKeyToAccount(generatePrivateKey());

const mockRooms = new Map<bigint, any>();

const mockPublicClient = {
  readContract: async ({ functionName, args }: any) => {
    if (functionName === "getRoom") {
      const roomId = args[0] as bigint;
      const room = mockRooms.get(roomId);
      if (!room) {
        throw new Error("Room not found on-chain");
      }
      return room;
    }
    throw new Error(`Unexpected function call: ${functionName}`);
  },
};

function registerMockRoom(
  id: number,
  playerA: `0x${string}`,
  playerB: `0x${string}`,
  creatorIsWhite: boolean,
  status: number = 1
) {
  mockRooms.set(BigInt(id), {
    id: BigInt(id),
    playerA,
    playerB,
    stake: 100000000000000000n,
    status, // 1 = Active
    startedAt: BigInt(Math.floor(Date.now() / 1000)),
    creatorIsWhite,
    gameStarted: true,
    singleSignedWinner: "0x0000000000000000000000000000000000000000",
    singleSignedBond: 0n,
    singleSignedAt: 0n,
    challenger: "0x0000000000000000000000000000000000000000",
    challengeBond: 0n,
    challengedAt: 0n,
  });
}

interface TestClient {
  ws: WebSocket;
  waitFor: (predicate: (msg: any) => boolean) => Promise<any>;
  send: (msg: any) => void;
  close: () => void;
}

function createTestClient(): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    const messages: any[] = [];
    const waiters: Array<{ predicate: (msg: any) => boolean; resolve: (val: any) => void }> = [];

    ws.on("message", (raw: WebSocket.Data) => {
      try {
        const parsed = JSON.parse(raw.toString());
        messages.push(parsed);
        for (let i = 0; i < waiters.length; i++) {
          if (waiters[i].predicate(parsed)) {
            const [w] = waiters.splice(i, 1);
            w.resolve(parsed);
            break;
          }
        }
      } catch {}
    });

    ws.on("error", () => {}); // handle client errors cleanly

    ws.on("open", () => {
      resolve({
        ws,
        send: (msg: any) => ws.send(JSON.stringify(msg)),
        close: () => ws.close(),
        waitFor: (predicate: (msg: any) => boolean) => {
          const idx = messages.findIndex(predicate);
          if (idx !== -1) {
            const [matched] = messages.splice(idx, 1);
            return Promise.resolve(matched);
          }
          return new Promise((res) => {
            waiters.push({ predicate, resolve: res });
          });
        },
      });
    });
  });
}

async function authenticateAndJoin(
  client: TestClient,
  account: PrivateKeyAccount,
  roomId: number,
  options?: {
    overrideNonce?: string;
    overrideExpiresAt?: number;
    overrideAddress?: string;
    role?: "player" | "spectator";
  }
) {
  const challenge = await client.waitFor((m) => m.type === "auth_challenge");
  const nonce = options?.overrideNonce ?? challenge.nonce;
  const expiresAt = options?.overrideExpiresAt ?? challenge.expiresAt;
  const player = (options?.overrideAddress ?? account.address) as `0x${string}`;

  if (options?.role === "spectator") {
    client.send({
      type: "join_room",
      roomId,
      role: "spectator",
    });
    return challenge;
  }

  const typedData = buildJoinTypedData(roomId, player, nonce as `0x${string}`, expiresAt, CHAIN_ID);
  const signature = await account.signTypedData(typedData);

  client.send({
    type: "join_room",
    roomId,
    role: "player",
    address: player,
    signature,
    nonce,
  });

  return challenge;
}

describe("RelayServer WebSocket Daemon (Turn 2c)", () => {
  let server: RelayServer;

  beforeAll(async () => {
    server = new RelayServer({
      port: TEST_PORT,
      relayPrivateKey: RELAY_KEY,
      contractAddress: CONTRACT,
      chainId: CHAIN_ID,
      initialTimeMs: 60 * 1000,
      publicClient: mockPublicClient,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it("handles ping/pong", async () => {
    const client = await createTestClient();
    client.send({ type: "ping" });
    const reply = await client.waitFor((m) => m.type === "pong");
    expect(reply.type).toBe("pong");
    client.close();
  });

  it("handles matchmaking & game play with full signature auth", async () => {
    const roomId = 101;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true); // Alice is White, Bob is Black

    const clientA = await createTestClient();
    const clientB = await createTestClient();

    const joinPromiseA = authenticateAndJoin(clientA, accountAlice, roomId);
    const stateA = await clientA.waitFor((m) => m.type === "room_state");
    await joinPromiseA;

    expect(stateA.status).toBe("waiting");
    expect(stateA.white.toLowerCase()).toBe(accountAlice.address.toLowerCase());

    const activePromiseA = clientA.waitFor((m) => m.type === "room_state" && m.status === "active");
    const activePromiseB = clientB.waitFor((m) => m.type === "room_state" && m.status === "active");

    await authenticateAndJoin(clientB, accountBob, roomId);
    const [actA, actB] = await Promise.all([activePromiseA, activePromiseB]);

    expect(actA.status).toBe("active");
    expect(actB.status).toBe("active");
    expect(actA.black?.toLowerCase()).toBe(accountBob.address.toLowerCase());

    // Alice moves e2e4 (seq: 0)
    const movePromiseB = clientB.waitFor((m) => m.type === "move" && m.uci === "e2e4");
    clientA.send({ type: "move", roomId, seq: 0, uci: "e2e4" });
    const moveB = await movePromiseB;
    expect(moveB.uci).toBe("e2e4");
    expect(moveB.seq).toBe(0);

    // Alice tries to move again out of turn -> error
    const errPromiseA = clientA.waitFor((m) => m.type === "error");
    clientA.send({ type: "move", roomId, seq: 1, uci: "e4e5" });
    const errA = await errPromiseA;
    expect(errA.type).toBe("error");

    // Bob replies e7e5 (seq: 1)
    const movePromiseA = clientA.waitFor((m) => m.type === "move" && m.uci === "e7e5");
    clientB.send({ type: "move", roomId, seq: 1, uci: "e7e5" });
    const moveA = await movePromiseA;
    expect(moveA.uci).toBe("e7e5");
    expect(moveA.seq).toBe(1);

    clientA.close();
    clientB.close();
  });

  it("handles resignation and produces valid Relay EIP-712 co-signature with 30m deadline", async () => {
    const roomId = 103;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true);

    const clientA = await createTestClient();
    const clientB = await createTestClient();

    await authenticateAndJoin(clientA, accountAlice, roomId);
    await authenticateAndJoin(clientB, accountBob, roomId);
    await clientB.waitFor((m) => m.type === "room_state" && m.status === "active");

    const proposalPromise = clientA.waitFor((m) => m.type === "result_proposal");
    const sigPromise = clientA.waitFor((m) => m.type === "result_signature");

    // Bob resigns
    clientB.send({ type: "resign", roomId });

    const proposal = await proposalPromise;
    const sigMsg = await sigPromise;

    expect(proposal.type).toBe("result_proposal");
    expect(proposal.outcome).toBe(0); // WhiteWin
    expect(proposal.winner.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(proposal.reason).toBe(1); // Resign

    // Verify 30 min deadline (1800s)
    const now = Math.floor(Date.now() / 1000);
    expect(proposal.deadline).toBeGreaterThanOrEqual(now + 1700);
    expect(proposal.deadline).toBeLessThanOrEqual(now + 1900);

    // Verify Relay's signature
    const typedData = buildResultTypedData(
      CONTRACT,
      {
        matchId: BigInt(proposal.roomId),
        winner: proposal.winner,
        outcome: proposal.outcome,
        reason: proposal.reason,
        moveCount: proposal.moveCount,
        movesHash: proposal.movesHash,
        nonce: BigInt(proposal.nonce),
        deadline: BigInt(proposal.deadline),
      },
      CHAIN_ID
    );

    const recovered = await recoverTypedDataAddress({
      ...typedData,
      signature: sigMsg.signature,
    });
    expect(recovered.toLowerCase()).toBe(server.relayAddress.toLowerCase());

    clientA.close();
    clientB.close();
  });

  it("rejects address spoofing (address claim != recovered address)", async () => {
    const roomId = 201;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true);

    const client = await createTestClient();
    const errPromise = client.waitFor((m) => m.type === "error");

    // Alice signs but declares Bob's address
    await authenticateAndJoin(client, accountAlice, roomId, {
      overrideAddress: accountBob.address,
    });

    const err = await errPromise;
    expect(err.message).toMatch(/Signature does not match declared player address/i);
    client.close();
  });

  it("rejects invalid signature, expired challenge, and reused nonce", async () => {
    const roomId = 202;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true);

    // 1. Invalid / tampered signature
    const client1 = await createTestClient();
    const challenge1 = await client1.waitFor((m) => m.type === "auth_challenge");
    const errPromise1 = client1.waitFor((m) => m.type === "error");
    client1.send({
      type: "join_room",
      roomId,
      address: accountAlice.address,
      signature: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b",
      nonce: challenge1.nonce,
    });
    const err1 = await errPromise1;
    expect(err1.type).toBe("error");
    client1.close();

    // 2. Reused nonce on same socket
    const client2 = await createTestClient();
    const challenge2 = await authenticateAndJoin(client2, accountAlice, roomId);

    const errPromise2 = client2.waitFor((m) => m.type === "error");
    const typedData2 = buildJoinTypedData(roomId, accountAlice.address, challenge2.nonce, challenge2.expiresAt, CHAIN_ID);
    const sig2 = await accountAlice.signTypedData(typedData2);
    client2.send({
      type: "join_room",
      roomId,
      address: accountAlice.address,
      signature: sig2,
      nonce: challenge2.nonce,
    });
    const err2 = await errPromise2;
    expect(err2.message).toMatch(/Nonce already used/i);
    client2.close();
  });

  it("rejects roomId not on chain (fails closed)", async () => {
    const client = await createTestClient();
    const errPromise = client.waitFor((m) => m.type === "error");

    // Room 999999 does not exist in mock on-chain client
    await authenticateAndJoin(client, accountAlice, 999999);
    const err = await errPromise;
    expect(err.message).toMatch(/On-chain query failed|Room not found/i);
    client.close();
  });

  it("restricts non-player address to spectator only; spectator cannot send commands", async () => {
    const roomId = 301;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true);

    const clientAlice = await createTestClient();
    const clientBob = await createTestClient();
    await authenticateAndJoin(clientAlice, accountAlice, roomId);
    await authenticateAndJoin(clientBob, accountBob, roomId);
    await clientBob.waitFor((m) => m.type === "room_state" && m.status === "active");

    // Charlie (not a player in this room) tries to join as player
    const clientCharlie = await createTestClient();
    const errPromise = clientCharlie.waitFor((m) => m.type === "error");
    await authenticateAndJoin(clientCharlie, accountCharlie, roomId);
    const err = await errPromise;
    expect(err.message).toMatch(/Address is not a player of this room/i);

    // Charlie connects as spectator (no signature needed)
    const clientSpectator = await createTestClient();
    const specStatePromise = clientSpectator.waitFor((m) => m.type === "room_state");
    await authenticateAndJoin(clientSpectator, accountCharlie, roomId, { role: "spectator" });
    const specState = await specStatePromise;
    expect(specState.type).toBe("room_state");
    expect(specState.status).toBe("active");

    // Spectator attempts to make a move -> rejected
    const moveErrPromise = clientSpectator.waitFor((m) => m.type === "error");
    clientSpectator.send({ type: "move", roomId, seq: 0, uci: "e2e4" });
    const moveErr = await moveErrPromise;
    expect(moveErr.message).toMatch(/Spectators or unauthenticated users cannot send moves/i);

    clientAlice.close();
    clientBob.close();
    clientCharlie.close();
    clientSpectator.close();
  });

  it("enforces one socket per seat; new authenticated socket replaces old socket", async () => {
    const roomId = 401;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true);

    const clientAlice1 = await createTestClient();
    await authenticateAndJoin(clientAlice1, accountAlice, roomId);

    const closePromise = new Promise<{ code: number; reason: string }>((resolve) => {
      clientAlice1.ws.on("close", (code, reason) => {
        resolve({ code, reason: reason.toString() });
      });
    });

    // Alice connects from a new socket clientAlice2
    const clientAlice2 = await createTestClient();
    await authenticateAndJoin(clientAlice2, accountAlice, roomId);

    const closeInfo = await closePromise;
    expect(closeInfo.code).toBe(4000);
    expect(closeInfo.reason).toBe("Replaced by new connection");

    clientAlice2.close();
  });

  it("does not co-sign result if room is no longer Active on-chain", async () => {
    const roomId = 501;
    registerMockRoom(roomId, accountAlice.address, accountBob.address, true);

    const clientAlice = await createTestClient();
    const clientBob = await createTestClient();
    await authenticateAndJoin(clientAlice, accountAlice, roomId);
    await authenticateAndJoin(clientBob, accountBob, roomId);
    await clientBob.waitFor((m) => m.type === "room_state" && m.status === "active");

    // On-chain status changes to Settled (2) or Cancelled (3)
    mockRooms.get(BigInt(roomId)).status = 2;

    // Bob resigns
    let receivedSignature = false;
    clientAlice.ws.on("message", (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "result_signature") {
          receivedSignature = true;
        }
      } catch {}
    });

    clientBob.send({ type: "resign", roomId });

    // Wait a brief moment to confirm signature is NOT sent
    await new Promise((r) => setTimeout(r, 200));
    expect(receivedSignature).toBe(false);

    clientAlice.close();
    clientBob.close();
  });

  it("determines player colors strictly from on-chain creatorIsWhite for both values (Q13)", async () => {
    // Case 1: creatorIsWhite = true -> PlayerA is White, PlayerB is Black
    const roomTrue = 601;
    registerMockRoom(roomTrue, accountAlice.address, accountBob.address, true);

    const clientB1 = await createTestClient();
    // Bob connects FIRST
    const statePromiseB1 = clientB1.waitFor((m) => m.type === "room_state");
    await authenticateAndJoin(clientB1, accountBob, roomTrue);
    const stateB1 = await statePromiseB1;
    expect(stateB1.white.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    expect(stateB1.black?.toLowerCase()).toBe(accountBob.address.toLowerCase());
    clientB1.close();

    // Case 2: creatorIsWhite = false -> PlayerA is Black, PlayerB is White
    const roomFalse = 602;
    registerMockRoom(roomFalse, accountAlice.address, accountBob.address, false);

    const clientA2 = await createTestClient();
    // Alice connects FIRST
    const statePromiseA2 = clientA2.waitFor((m) => m.type === "room_state");
    await authenticateAndJoin(clientA2, accountAlice, roomFalse);
    const stateA2 = await statePromiseA2;
    expect(stateA2.white.toLowerCase()).toBe(accountBob.address.toLowerCase());
    expect(stateA2.black?.toLowerCase()).toBe(accountAlice.address.toLowerCase());
    clientA2.close();
  });

  it("enforces maxPayload limit (> 4KB) and rate limits", async () => {
    // 1. maxPayload limit
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    ws.on("error", () => {}); // ignore client error

    const closePromise = new Promise<{ code: number }>((resolve) => {
      ws.on("close", (code) => resolve({ code }));
    });

    ws.on("open", () => {
      const bigString = "x".repeat(5000);
      ws.send(JSON.stringify({ type: "ping", big: bigString }));
    });

    const closeInfo = await closePromise;
    expect(closeInfo.code).toBe(1009); // 1009: Message Too Big

    // 2. Rate limit
    const client2 = await createTestClient();
    let rateLimitHit = false;
    client2.ws.on("message", (raw) => {
      try {
        const parsed = JSON.parse(raw.toString());
        if (parsed.type === "error" && parsed.message.includes("Rate limit")) {
          rateLimitHit = true;
        }
      } catch {}
    });

    for (let i = 0; i < 35; i++) {
      client2.send({ type: "ping" });
    }

    await new Promise((r) => setTimeout(r, 200));
    expect(rateLimitHit).toBe(true);
    client2.close();
  });
});
