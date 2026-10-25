import { describe, it, expect } from "vitest";
import {
  joinRoomSchema,
  moveSchema,
  resultProposalSchema,
  clientMessageSchema,
  serverMessageSchema,
  clockSyncSchema,
  roomStateSchema,
} from "../src/schemas.js";
import { OutcomeCode, ReasonCode } from "../src/types.js";

describe("joinRoomSchema", () => {
  it("should accept valid join_room message", () => {
    const msg = {
      type: "join_room",
      roomId: 1,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    };
    expect(joinRoomSchema.parse(msg)).toEqual(msg);
  });

  it("should reject invalid address", () => {
    expect(() =>
      joinRoomSchema.parse({
        type: "join_room",
        roomId: 1,
        address: "not-an-address",
      }),
    ).toThrow();
  });

  it("should reject negative roomId", () => {
    expect(() =>
      joinRoomSchema.parse({
        type: "join_room",
        roomId: -1,
        address: "0x1234567890abcdef1234567890abcdef12345678",
      }),
    ).toThrow();
  });
});

describe("moveSchema", () => {
  it("should accept valid move", () => {
    const msg = { type: "move", roomId: 1, seq: 0, uci: "e2e4" };
    expect(moveSchema.parse(msg)).toEqual(msg);
  });

  it("should accept promotion move", () => {
    const msg = { type: "move", roomId: 1, seq: 10, uci: "a7a8q" };
    expect(moveSchema.parse(msg)).toEqual(msg);
  });

  it("should reject invalid UCI", () => {
    expect(() =>
      moveSchema.parse({ type: "move", roomId: 1, seq: 0, uci: "xyz" }),
    ).toThrow();
  });

  it("should reject out-of-board coordinates", () => {
    expect(() =>
      moveSchema.parse({ type: "move", roomId: 1, seq: 0, uci: "z9a1" }),
    ).toThrow();
  });
});

describe("resultProposalSchema", () => {
  it("should accept valid result proposal with expanded fields", () => {
    const msg = {
      type: "result_proposal",
      roomId: 1,
      winner: "0x1234567890abcdef1234567890abcdef12345678",
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Checkmate,
      moveCount: 42,
      movesHash:
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      nonce: 1,
      deadline: 1700000000,
    };
    expect(resultProposalSchema.parse(msg)).toEqual(msg);
  });

  it("should accept draw result proposal", () => {
    const msg = {
      type: "result_proposal",
      roomId: 1,
      winner: "0x0000000000000000000000000000000000000000",
      outcome: OutcomeCode.Draw,
      reason: ReasonCode.Agreement,
      moveCount: 20,
      movesHash:
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      nonce: 1,
      deadline: 1700000000,
    };
    expect(resultProposalSchema.parse(msg)).toEqual(msg);
  });

  it("should reject invalid outcome (> 2)", () => {
    expect(() =>
      resultProposalSchema.parse({
        type: "result_proposal",
        roomId: 1,
        winner: "0x1234567890abcdef1234567890abcdef12345678",
        outcome: 3,
        reason: 0,
        moveCount: 10,
        movesHash:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        nonce: 1,
        deadline: 1700000000,
      }),
    ).toThrow();
  });

  it("should reject invalid reason (> 7)", () => {
    expect(() =>
      resultProposalSchema.parse({
        type: "result_proposal",
        roomId: 1,
        winner: "0x1234567890abcdef1234567890abcdef12345678",
        outcome: 0,
        reason: 8,
        moveCount: 10,
        movesHash:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        nonce: 1,
        deadline: 1700000000,
      }),
    ).toThrow();
  });
});

describe("clockSyncSchema", () => {
  it("should accept valid clock sync", () => {
    const msg = {
      type: "clock_sync",
      roomId: 1,
      whiteMs: 300000,
      blackMs: 295000,
    };
    expect(clockSyncSchema.parse(msg)).toEqual(msg);
  });

  it("should reject negative time", () => {
    expect(() =>
      clockSyncSchema.parse({
        type: "clock_sync",
        roomId: 1,
        whiteMs: -1,
        blackMs: 300000,
      }),
    ).toThrow();
  });
});

describe("roomStateSchema", () => {
  it("should accept valid room state", () => {
    const msg = {
      type: "room_state",
      roomId: 1,
      white: "0x1234567890abcdef1234567890abcdef12345678",
      moves: ["e2e4", "e7e5"],
      whiteMs: 300000,
      blackMs: 300000,
      status: "active",
    };
    expect(roomStateSchema.parse(msg)).toEqual(msg);
  });

  it("should accept room state with black player", () => {
    const msg = {
      type: "room_state",
      roomId: 1,
      white: "0x1234567890abcdef1234567890abcdef12345678",
      black: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      moves: [],
      whiteMs: 300000,
      blackMs: 300000,
      status: "waiting",
    };
    expect(roomStateSchema.parse(msg)).toEqual(msg);
  });
});

describe("clientMessageSchema (discriminated union)", () => {
  it("should parse join_room", () => {
    const msg = {
      type: "join_room",
      roomId: 1,
      address: "0x1234567890abcdef1234567890abcdef12345678",
    };
    const parsed = clientMessageSchema.parse(msg);
    expect(parsed.type).toBe("join_room");
  });

  it("should parse move", () => {
    const msg = { type: "move", roomId: 1, seq: 0, uci: "e2e4" };
    const parsed = clientMessageSchema.parse(msg);
    expect(parsed.type).toBe("move");
  });

  it("should parse ping", () => {
    const parsed = clientMessageSchema.parse({ type: "ping" });
    expect(parsed.type).toBe("ping");
  });

  it("should reject unknown type", () => {
    expect(() =>
      clientMessageSchema.parse({ type: "unknown_type" }),
    ).toThrow();
  });
});

describe("serverMessageSchema (discriminated union)", () => {
  it("should parse room_state", () => {
    const msg = {
      type: "room_state",
      roomId: 1,
      white: "0x1234567890abcdef1234567890abcdef12345678",
      moves: [],
      whiteMs: 300000,
      blackMs: 300000,
      status: "waiting",
    };
    const parsed = serverMessageSchema.parse(msg);
    expect(parsed.type).toBe("room_state");
  });

  it("should parse pong", () => {
    const parsed = serverMessageSchema.parse({ type: "pong" });
    expect(parsed.type).toBe("pong");
  });

  it("should parse error", () => {
    const parsed = serverMessageSchema.parse({
      type: "error",
      message: "Room not found",
      code: "ROOM_NOT_FOUND",
    });
    expect(parsed.type).toBe("error");
  });

  it("should parse result_proposal with expanded fields", () => {
    const parsed = serverMessageSchema.parse({
      type: "result_proposal",
      roomId: 1,
      winner: "0x1234567890abcdef1234567890abcdef12345678",
      outcome: 0,
      reason: 0,
      moveCount: 10,
      movesHash: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      nonce: 1,
      deadline: 1700000000,
    });
    expect(parsed.type).toBe("result_proposal");
  });
});

describe("focusWarningSchema", () => {
  it("should accept valid focus_warning", () => {
    const msg = {
      type: "focus_warning",
      player: "w",
      warningCount: 2,
      penaltyMs: 10000,
    };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
    expect(clientMessageSchema.parse(msg)).toEqual(msg);
  });

  it("should reject invalid warning count (> 3 or < 1)", () => {
    expect(() =>
      serverMessageSchema.parse({
        type: "focus_warning",
        player: "b",
        warningCount: 4,
        penaltyMs: 10000,
      }),
    ).toThrow();
  });
});

describe("spectatorPoolUpdateSchema", () => {
  it("should accept valid spectator_pool update with draw pool", () => {
    const msg = {
      type: "spectator_pool",
      whitePoolAvax: "1.5",
      blackPoolAvax: "0.8",
      drawPoolAvax: "0.4",
      isLocked: false,
    };
    expect(serverMessageSchema.parse(msg)).toEqual(msg);
  });

  it("should reject missing field", () => {
    expect(() =>
      serverMessageSchema.parse({
        type: "spectator_pool",
        whitePoolAvax: "1.5",
        blackPoolAvax: "0.8",
      }),
    ).toThrow();
  });
});
