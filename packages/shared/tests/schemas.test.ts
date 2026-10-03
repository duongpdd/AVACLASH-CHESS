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
  it("should accept valid result proposal", () => {
    const msg = {
      type: "result_proposal",
      roomId: 1,
      winner: "0x1234567890abcdef1234567890abcdef12345678",
      movesHash:
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      nonce: 1,
      reason: "checkmate",
    };
    expect(resultProposalSchema.parse(msg)).toEqual(msg);
  });

  it("should reject invalid reason", () => {
    expect(() =>
      resultProposalSchema.parse({
        type: "result_proposal",
        roomId: 1,
        winner: "0x1234567890abcdef1234567890abcdef12345678",
        movesHash:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        nonce: 1,
        reason: "invalid_reason",
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
});
