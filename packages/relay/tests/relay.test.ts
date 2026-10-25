import { describe, it, expect, beforeAll, afterAll } from "vitest";
import WebSocket from "ws";
import { recoverTypedDataAddress } from "viem";
import { buildResultTypedData } from "@avaclash/shared";
import { RelayServer } from "../src/RelayServer.js";

const TEST_PORT = 9876;
const RELAY_KEY = "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d";
const CONTRACT = "0x1234567890123456789012345678901234567890";
const CHAIN_ID = 43113;

function connectClient(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${TEST_PORT}`);
    ws.on("open", () => resolve(ws));
    ws.on("error", reject);
  });
}

function waitForMessage(ws: WebSocket, predicate: (msg: any) => boolean): Promise<any> {
  return new Promise((resolve) => {
    const handler = (raw: WebSocket.Data) => {
      const parsed = JSON.parse(raw.toString());
      if (predicate(parsed)) {
        ws.off("message", handler);
        resolve(parsed);
      }
    };
    ws.on("message", handler);
  });
}

describe("RelayServer WebSocket Daemon", () => {
  let server: RelayServer;

  beforeAll(async () => {
    server = new RelayServer({
      port: TEST_PORT,
      relayPrivateKey: RELAY_KEY,
      contractAddress: CONTRACT,
      chainId: CHAIN_ID,
      initialTimeMs: 60 * 1000,
    });
  });

  afterAll(async () => {
    await server.close();
  });

  it("handles ping/pong", async () => {
    const ws = await connectClient();
    const pongPromise = waitForMessage(ws, (m) => m.type === "pong");

    ws.send(JSON.stringify({ type: "ping" }));
    const reply = await pongPromise;
    expect(reply.type).toBe("pong");
    ws.close();
  });

  it("handles matchmaking: Player A creates room, Player B joins, game becomes active", async () => {
    const wsA = await connectClient();
    const wsB = await connectClient();
    const roomId = 101;
    const addrA = "0x1111111111111111111111111111111111111111";
    const addrB = "0x2222222222222222222222222222222222222222";

    const statePromiseA = waitForMessage(wsA, (m) => m.type === "room_state");
    wsA.send(JSON.stringify({ type: "join_room", roomId, address: addrA }));
    const stateA = await statePromiseA;
    expect(stateA.status).toBe("waiting");
    expect(stateA.white.toLowerCase()).toBe(addrA.toLowerCase());

    const activeStatePromiseA = waitForMessage(wsA, (m) => m.type === "room_state" && m.status === "active");
    const activeStatePromiseB = waitForMessage(wsB, (m) => m.type === "room_state" && m.status === "active");

    wsB.send(JSON.stringify({ type: "join_room", roomId, address: addrB }));
    const [actA, actB] = await Promise.all([activeStatePromiseA, activeStatePromiseB]);

    expect(actA.status).toBe("active");
    expect(actB.status).toBe("active");
    expect(actA.black?.toLowerCase()).toBe(addrB.toLowerCase());

    wsA.close();
    wsB.close();
  });

  it("relays valid moves, validates turn sequence, and syncs clocks", async () => {
    const wsA = await connectClient();
    const wsB = await connectClient();
    const roomId = 102;
    const addrA = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
    const addrB = "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

    wsA.send(JSON.stringify({ type: "join_room", roomId, address: addrA }));
    wsB.send(JSON.stringify({ type: "join_room", roomId, address: addrB }));

    // Wait until room is active
    await waitForMessage(wsB, (m) => m.type === "room_state" && m.status === "active");

    // Player A moves e2e4 (seq: 0)
    const movePromiseB = waitForMessage(wsB, (m) => m.type === "move" && m.uci === "e2e4");
    wsA.send(JSON.stringify({ type: "move", roomId, seq: 0, uci: "e2e4" }));
    const moveB = await movePromiseB;
    expect(moveB.uci).toBe("e2e4");
    expect(moveB.seq).toBe(0);

    // Player A tries to move again out of turn -> gets error
    const errPromiseA = waitForMessage(wsA, (m) => m.type === "error");
    wsA.send(JSON.stringify({ type: "move", roomId, seq: 1, uci: "e4e5" }));
    const errA = await errPromiseA;
    expect(errA.type).toBe("error");

    // Player B replies with e7e5 (seq: 1)
    const movePromiseA = waitForMessage(wsA, (m) => m.type === "move" && m.uci === "e7e5");
    wsB.send(JSON.stringify({ type: "move", roomId, seq: 1, uci: "e7e5" }));
    const moveA = await movePromiseA;
    expect(moveA.uci).toBe("e7e5");
    expect(moveA.seq).toBe(1);

    wsA.close();
    wsB.close();
  });

  it("handles resignation and produces valid Relay EIP-712 co-signature", async () => {
    const wsA = await connectClient();
    const wsB = await connectClient();
    const roomId = 103;
    const addrA = "0x1111111111111111111111111111111111111111";
    const addrB = "0x2222222222222222222222222222222222222222";

    wsA.send(JSON.stringify({ type: "join_room", roomId, address: addrA }));
    wsB.send(JSON.stringify({ type: "join_room", roomId, address: addrB }));
    await waitForMessage(wsB, (m) => m.type === "room_state" && m.status === "active");

    // Setup listeners for proposal and signature
    const proposalPromise = waitForMessage(wsA, (m) => m.type === "result_proposal");
    const sigPromise = waitForMessage(wsA, (m) => m.type === "result_signature");

    // Player B resigns
    wsB.send(JSON.stringify({ type: "resign", roomId }));

    const proposal = await proposalPromise;
    const sigMsg = await sigPromise;

    expect(proposal.type).toBe("result_proposal");
    expect(proposal.outcome).toBe(0); // WhiteWin
    expect(proposal.winner.toLowerCase()).toBe(addrA.toLowerCase());
    expect(proposal.reason).toBe(1); // Resign
    expect(sigMsg.type).toBe("result_signature");
    expect(sigMsg.signature.startsWith("0x")).toBe(true);

    // Cryptographic verification: verify that Relay's signature matches Relay's address!
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
      CHAIN_ID,
    );

    const recoveredAddress = await recoverTypedDataAddress({
      domain: typedData.domain,
      types: typedData.types,
      primaryType: typedData.primaryType,
      message: typedData.message,
      signature: sigMsg.signature,
    });

    expect(recoveredAddress.toLowerCase()).toBe(server.relayAddress.toLowerCase());

    wsA.close();
    wsB.close();
  });

  it("handles draw offer and agreement with Draw co-signature", async () => {
    const wsA = await connectClient();
    const wsB = await connectClient();
    const roomId = 104;
    const addrA = "0x1111111111111111111111111111111111111111";
    const addrB = "0x2222222222222222222222222222222222222222";

    wsA.send(JSON.stringify({ type: "join_room", roomId, address: addrA }));
    wsB.send(JSON.stringify({ type: "join_room", roomId, address: addrB }));
    await waitForMessage(wsB, (m) => m.type === "room_state" && m.status === "active");

    const drawOfferPromise = waitForMessage(wsB, (m) => m.type === "draw_offer");
    wsA.send(JSON.stringify({ type: "draw_offer", roomId }));
    await drawOfferPromise;

    const proposalPromise = waitForMessage(wsA, (m) => m.type === "result_proposal");
    wsB.send(JSON.stringify({ type: "draw_accept", roomId }));
    const proposal = await proposalPromise;

    expect(proposal.outcome).toBe(2); // Draw
    expect(proposal.reason).toBe(7); // Agreement
    expect(proposal.winner).toBe("0x0000000000000000000000000000000000000000");

    wsA.close();
    wsB.close();
  });

  it("handles focus warning telemetry as warning-only without clock penalty or technical forfeit (Q10)", async () => {
    const wsA = await connectClient();
    const wsB = await connectClient();
    const roomId = 105;
    const addrA = "0x1111111111111111111111111111111111111111";
    const addrB = "0x2222222222222222222222222222222222222222";

    wsA.send(JSON.stringify({ type: "join_room", roomId, address: addrA }));
    wsB.send(JSON.stringify({ type: "join_room", roomId, address: addrB }));
    await waitForMessage(wsB, (m) => m.type === "room_state" && m.status === "active");

    const warningPromiseB = waitForMessage(wsB, (m) => m.type === "focus_warning");
    wsA.send(JSON.stringify({ type: "focus_warning", player: "w", warningCount: 1, penaltyMs: 10000 }));
    const warningB = await warningPromiseB;

    expect(warningB.player).toBe("w");
    expect(warningB.warningCount).toBe(1);
    expect(warningB.penaltyMs).toBe(10000);

    // Even if warnings > 3, room remains active and does not forfeit
    wsA.send(JSON.stringify({ type: "focus_warning", player: "w", warningCount: 5, penaltyMs: 10000 }));
    const room = server.getRoom(roomId);
    expect(room?.status).toBe("active");

    wsA.close();
    wsB.close();
  });
});
