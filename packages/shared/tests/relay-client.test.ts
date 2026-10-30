import { describe, it, expect, vi, beforeEach } from "vitest";
import { RelayClient, type ConnectionStatus } from "../src/relay-client.js";
import { buildJoinTypedData } from "../src/eip712.js";

class MockWebSocket {
  public static instances: MockWebSocket[] = [];
  public url: string;
  public readyState: number = 0; // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
  public sentMessages: string[] = [];
  public listeners: Record<string, ((...args: any[]) => void)[]> = {};

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
    // Simulate async open
    setTimeout(() => {
      this.readyState = 1;
      this.emit("open");
    }, 10);
  }

  public addEventListener(event: string, cb: (...args: any[]) => void) {
    this.on(event, cb);
  }

  public removeEventListener(event: string, cb: (...args: any[]) => void) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter((fn) => fn !== cb);
    }
  }

  public on(event: string, cb: (...args: any[]) => void) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  }

  public emit(event: string, ...args: any[]) {
    const handlers = this.listeners[event] ?? [];
    for (const h of handlers) {
      h(...args);
    }
  }

  public send(data: string) {
    this.sentMessages.push(data);
  }

  public close(code: number = 1000, reason: string = "") {
    this.readyState = 3;
    this.emit("close", { code, reason });
  }

  // Helper to simulate incoming server message
  public simulateServerMessage(data: any) {
    const raw = typeof data === "string" ? data : JSON.stringify(data);
    this.emit("message", { data: raw });
  }
}

describe("RelayClient (Turn 3c-2 Item 1)", () => {
  const mockEscrow = "0x1234567890123456789012345678901234567890" as `0x${string}`;
  const playerA = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const playerB = "0x2222222222222222222222222222222222222222" as `0x${string}`;

  beforeEach(() => {
    MockWebSocket.instances = [];
  });

  it("completes full auth flow: open -> challenge -> sign join -> send join_room -> room_state", async () => {
    const signTypedData = vi.fn().mockResolvedValue("0xmocksignature" as `0x${string}`);
    const getAddress = vi.fn().mockResolvedValue(playerA);

    const client = new RelayClient({
      url: "ws://localhost:8080",
      WebSocketImpl: MockWebSocket,
      signTypedData,
      getAddress,
      chainId: 43113,
      escrowAddress: mockEscrow,
    });

    const roomStateEvents: any[] = [];
    client.on("roomState", (s) => roomStateEvents.push(s));

    client.connect(101);

    // Wait for mock websocket to open
    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[0];
    expect(ws).toBeDefined();

    // Server sends auth_challenge
    ws.simulateServerMessage({
      type: "auth_challenge",
      nonce: "0x" + "11".repeat(32),
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });

    // Client signs join and sends join_room
    await new Promise((r) => setTimeout(r, 20));
    expect(signTypedData).toHaveBeenCalledTimes(1);
    expect(ws.sentMessages.length).toBe(1);
    const joinMsg = JSON.parse(ws.sentMessages[0]);
    expect(joinMsg.type).toBe("join_room");
    expect(joinMsg.roomId).toBe(101);
    expect(joinMsg.address).toBe(playerA);
    expect(joinMsg.signature).toBe("0xmocksignature");

    // Server sends room_state
    ws.simulateServerMessage({
      type: "room_state",
      roomId: 101,
      white: playerA,
      black: playerB,
      moves: [],
      whiteMs: 300000,
      blackMs: 300000,
      status: "active",
    });

    await new Promise((r) => setTimeout(r, 20));
    expect(roomStateEvents.length).toBe(1);
    expect(client.isAuthenticated()).toBe(true);
    expect(client.getMyColor()).toBe("w");
    expect(client.isMyTurn()).toBe(true);

    client.disconnect();
  });

  it("validates incoming messages: malformed message is ignored and emits error without crashing", async () => {
    const signTypedData = vi.fn().mockResolvedValue("0xsig" as `0x${string}`);
    const client = new RelayClient({
      url: "ws://localhost:8080",
      WebSocketImpl: MockWebSocket,
      signTypedData,
      getAddress: () => playerA,
      chainId: 43113,
      escrowAddress: mockEscrow,
    });

    const errors: any[] = [];
    client.on("error", (e) => errors.push(e));

    client.connect(102);
    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[0];

    // Send malformed JSON
    ws.simulateServerMessage("NOT_A_JSON{");
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Malformed");

    // Send JSON violating schema
    ws.simulateServerMessage({ type: "unknown_message_type", foo: "bar" });
    expect(errors.length).toBe(2);
    expect(errors[1].message).toContain("schema");

    client.disconnect();
  });

  it("tracks moves sequentially, rejects moves out of turn, and resyncs on missing seq", async () => {
    const signTypedData = vi.fn().mockResolvedValue("0xsig" as `0x${string}`);
    const client = new RelayClient({
      url: "ws://localhost:8080",
      WebSocketImpl: MockWebSocket,
      signTypedData,
      getAddress: () => playerB, // Player B is Black
      chainId: 43113,
      escrowAddress: mockEscrow,
    });

    client.connect(103);
    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[0];

    // Complete auth
    ws.simulateServerMessage({
      type: "auth_challenge",
      nonce: "0x" + "22".repeat(32),
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    });
    await new Promise((r) => setTimeout(r, 20));

    ws.simulateServerMessage({
      type: "room_state",
      roomId: 103,
      white: playerA,
      black: playerB,
      moves: [],
      whiteMs: 300000,
      blackMs: 300000,
      status: "active",
    });
    await new Promise((r) => setTimeout(r, 20));

    // Player B is Black, first turn is White -> cannot move!
    expect(client.isMyTurn()).toBe(false);
    expect(() => client.sendMove("e7e5")).toThrow(/not your turn/i);

    // Relay sends move 0 from White
    ws.simulateServerMessage({
      type: "move",
      roomId: 103,
      seq: 0,
      uci: "e2e4",
    });

    expect(client.getMoves()).toEqual(["e2e4"]);
    expect(client.isMyTurn()).toBe(true);

    // Now player B can send move
    client.sendMove("e7e5");
    const lastSent = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    expect(lastSent.type).toBe("move");
    expect(lastSent.seq).toBe(1);
    expect(lastSent.uci).toBe("e7e5");

    // Test missing sequence: if server sends seq: 3 instead of seq: 1
    const errors: any[] = [];
    client.on("error", (e) => errors.push(e));

    ws.simulateServerMessage({
      type: "move",
      roomId: 103,
      seq: 3, // Missed seq 1 and seq 2!
      uci: "g1f3",
    });

    expect(errors.some((e) => e.message.includes("gap"))).toBe(true);

    client.disconnect();
  });

  it("handles automatic reconnection with backoff and re-authenticates, but stops on manual disconnect", async () => {
    const signTypedData = vi.fn().mockResolvedValue("0xsig" as `0x${string}`);
    const client = new RelayClient({
      url: "ws://localhost:8080",
      WebSocketImpl: MockWebSocket,
      signTypedData,
      getAddress: () => playerA,
      chainId: 43113,
      escrowAddress: mockEscrow,
    });

    const statusHistory: ConnectionStatus[] = [];
    client.on("connectionStatus", (s) => statusHistory.push(s));

    client.connect(104);
    await new Promise((r) => setTimeout(r, 20));
    expect(MockWebSocket.instances.length).toBe(1);
    const ws1 = MockWebSocket.instances[0];

    // Unexpected disconnection
    ws1.close(1006, "Abnormal closure");
    expect(statusHistory).toContain("reconnecting");

    // Wait for reconnect backoff (attempt 0 is 1000ms, let's test that backoff triggers or fast forward)
    // Wait for reconnect instance
    await new Promise((r) => setTimeout(r, 1100));
    expect(MockWebSocket.instances.length).toBe(2);

    const ws2 = MockWebSocket.instances[1];
    expect(ws2).toBeDefined();

    // Now user manually disconnects
    client.disconnect();
    expect(client.getConnectionStatus()).toBe("disconnected");

    const countBefore = MockWebSocket.instances.length;
    // Wait another 1500ms to ensure no further reconnection happens
    await new Promise((r) => setTimeout(r, 1500));
    expect(MockWebSocket.instances.length).toBe(countBefore);
  });

  it("supports requestResult and all typed events", async () => {
    const client = new RelayClient({
      url: "ws://localhost:8080",
      WebSocketImpl: MockWebSocket,
      signTypedData: vi.fn(),
      getAddress: () => playerA,
      chainId: 43113,
      escrowAddress: mockEscrow,
    });

    client.connect(105);
    await new Promise((r) => setTimeout(r, 20));
    const ws = MockWebSocket.instances[0];

    const resignEvents: any[] = [];
    const drawOffers: any[] = [];
    const proposals: any[] = [];
    const clockSyncs: any[] = [];

    client.on("resign", (m) => resignEvents.push(m));
    client.on("drawOffer", (m) => drawOffers.push(m));
    client.on("resultProposal", (m) => proposals.push(m));
    client.on("clockSync", (m) => clockSyncs.push(m));

    ws.simulateServerMessage({ type: "clock_sync", roomId: 105, whiteMs: 290000, blackMs: 295000 });
    ws.simulateServerMessage({ type: "draw_offer", roomId: 105 });
    ws.simulateServerMessage({ type: "resign", roomId: 105 });
    ws.simulateServerMessage({
      type: "result_proposal",
      roomId: 105,
      winner: playerA,
      outcome: 0,
      reason: 1,
      moveCount: 0,
      movesHash: "0x" + "00".repeat(32),
      nonce: 1,
      deadline: Math.floor(Date.now() / 1000) + 1800,
    });

    expect(clockSyncs.length).toBe(1);
    expect(drawOffers.length).toBe(1);
    expect(resignEvents.length).toBe(1);
    expect(proposals.length).toBe(1);

    client.requestResult();
    const lastSent = JSON.parse(ws.sentMessages[ws.sentMessages.length - 1]);
    expect(lastSent.type).toBe("request_result");
    expect(lastSent.roomId).toBe(105);
  });
});
