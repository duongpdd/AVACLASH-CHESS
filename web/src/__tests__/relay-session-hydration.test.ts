// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  OutcomeCode,
  ReasonCode,
  computeMovesHash,
  type SeenTerminalEvents,
  type FinishedInfo,
  type RoomStateMessage,
} from "@avaclash/shared";

// Prepare mocks for wagmi
const mocks = vi.hoisted(() => {
  const address = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const signTypedDataAsync = vi
    .fn()
    .mockResolvedValue("0xmysig" as `0x${string}`);
  const writeContractAsync = vi
    .fn()
    .mockResolvedValue("0xtxhash" as `0x${string}`);

  return {
    getAddress: () => address,
    signTypedDataAsync,
    writeContractAsync,
  };
});

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({ address: mocks.getAddress() }),
    useSignTypedData: () => ({
      signTypedDataAsync: mocks.signTypedDataAsync,
    }),
    useWriteContract: () => ({
      writeContractAsync: mocks.writeContractAsync,
      reset: vi.fn(),
    }),
    useWaitForTransactionReceipt: () => ({
      data: { status: "success" },
      isLoading: false,
      isSuccess: true,
    }),
  };
});

// Mock RelayClient from @avaclash/shared
interface HydrationMock {
  seenEvents: SeenTerminalEvents;
  finishedInfo: FinishedInfo | null;
  roomState: RoomStateMessage | null;
  emit(event: string, ...args: unknown[]): void;
}
let mockRelayClientInstance: HydrationMock;
function registerClient(client: HydrationMock) {
  mockRelayClientInstance = client;
}

vi.mock("@avaclash/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avaclash/shared")>();
  class MockRelayClient {
    public listeners: Record<string, ((...args: unknown[]) => void)[]> = {};
    public seenEvents: SeenTerminalEvents = {};
    public finishedInfo: FinishedInfo | null = null;
    public roomState: RoomStateMessage | null = null;

    constructor() {
      registerClient(this);
    }

    on(event: string, cb: (...args: unknown[]) => void) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(cb);
      return () => {
        this.listeners[event] = this.listeners[event].filter((f) => f !== cb);
      };
    }

    emit(event: string, ...args: unknown[]) {
      this.listeners[event]?.forEach((cb) => cb(...args));
    }

    connect() {
      // simulate connection and emitting finished roomState if set
      if (this.roomState) {
        this.emit("roomState", this.roomState);
      }
    }

    disconnect() {}

    getSeenEvents() {
      return this.seenEvents;
    }

    getSeenTerminalEvents() {
      return this.seenEvents;
    }

    getFinishedInfo() {
      return this.finishedInfo;
    }
  }

  return {
    ...actual,
    RelayClient: MockRelayClient,
  };
});

import { useRelaySession } from "../hooks/useRelaySession";
import { useSubmitResult } from "../hooks/useSubmitResult";

describe("Relay Session Hydration on Reload (Turn 3c-3 Item 2)", () => {
  const roomId = 77;
  const white = "0x1111111111111111111111111111111111111111" as `0x${string}`;
  const black = "0x2222222222222222222222222222222222222222" as `0x${string}`;
  const moves = ["e2e4"]; // 1 move -> Black's turn
  const movesHash = computeMovesHash(moves);
  const deadline = Math.floor(Date.now() / 1000) + 1000;
  const relaySig = ("0x" + "bb".repeat(65)) as `0x${string}`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hydrates seenEvents on reload after resignation and allows successful submit", async () => {
    const { result: sessionResult } = renderHook(() => useRelaySession(roomId));

    // Simulate reload where RelayClient already has finishedInfo and seenEvents for Resignation
    act(() => {
      mockRelayClientInstance.seenEvents = {
        resignSeen: true,
        resignerColor: "b",
      };
      mockRelayClientInstance.finishedInfo = {
        roomId,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        winner: white,
        moveCount: moves.length,
      };
      mockRelayClientInstance.emit("roomState", {
        type: "room_state",
        roomId,
        white,
        black,
        status: "finished",
        moves,
        whiteMs: 280000,
        blackMs: 270000,
        drawOfferedBy: null,
      });
      mockRelayClientInstance.emit("gameFinished", {
        type: "game_finished",
        roomId,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        winner: white,
        moveCount: moves.length,
      });
    });

    // Check that seenEvents in useRelaySession has hydrated resignerColor and resignSeen
    expect(sessionResult.current.seenEvents.resignSeen).toBe(true);
    expect(sessionResult.current.seenEvents.resignerColor).toBe("b");

    // Submit with hydrated seenEvents
    const { result: submitResult } = renderHook(() => useSubmitResult(roomId));
    const proposal = {
      type: "result_proposal" as const,
      roomId,
      winner: white,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Resign,
      moveCount: moves.length,
      movesHash,
      nonce: 1,
      deadline,
    };

    await act(async () => {
      await submitResult.current.submit({
        proposal,
        relaySignature: relaySig,
        moves,
        white,
        black,
        seenEvents: sessionResult.current.seenEvents,
      });
    });

    expect(submitResult.current.step).toBe("confirmed");
    expect(submitResult.current.isSuccess).toBe(true);
  });

  it("hydrates seenEvents on reload after timeout and allows successful submit", async () => {
    const { result: sessionResult } = renderHook(() => useRelaySession(roomId));

    // Simulate reload where RelayClient has finishedInfo for Timeout (Black timed out on move 1)
    act(() => {
      mockRelayClientInstance.seenEvents = {
        timeoutSeen: true,
        timeoutPlayer: "b",
      };
      mockRelayClientInstance.finishedInfo = {
        roomId,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Timeout,
        winner: white,
        moveCount: moves.length,
      };
      mockRelayClientInstance.emit("gameFinished", {
        type: "game_finished",
        roomId,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Timeout,
        winner: white,
        moveCount: moves.length,
      });
    });

    expect(sessionResult.current.seenEvents.timeoutSeen).toBe(true);
    expect(sessionResult.current.seenEvents.timeoutPlayer).toBe("b");

    const { result: submitResult } = renderHook(() => useSubmitResult(roomId));
    const proposal = {
      type: "result_proposal" as const,
      roomId,
      winner: white,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Timeout,
      moveCount: moves.length,
      movesHash,
      nonce: 1,
      deadline,
    };

    await act(async () => {
      await submitResult.current.submit({
        proposal,
        relaySignature: relaySig,
        moves,
        white,
        black,
        seenEvents: sessionResult.current.seenEvents,
      });
    });

    expect(submitResult.current.step).toBe("confirmed");
    expect(submitResult.current.isSuccess).toBe(true);
  });

  it("hydrates seenEvents on reload after draw agreement and allows successful submit", async () => {
    const { result: sessionResult } = renderHook(() => useRelaySession(roomId));

    // Simulate reload where RelayClient has finishedInfo for draw agreement
    act(() => {
      mockRelayClientInstance.seenEvents = {
        drawAcceptSeen: true,
      };
      mockRelayClientInstance.finishedInfo = {
        roomId,
        outcome: OutcomeCode.Draw,
        reason: ReasonCode.Agreement,
        winner: "0x0000000000000000000000000000000000000000",
        moveCount: moves.length,
      };
      mockRelayClientInstance.emit("gameFinished", {
        type: "game_finished",
        roomId,
        outcome: OutcomeCode.Draw,
        reason: ReasonCode.Agreement,
        winner: "0x0000000000000000000000000000000000000000",
        moveCount: moves.length,
      });
    });

    expect(sessionResult.current.seenEvents.drawAcceptSeen).toBe(true);

    const { result: submitResult } = renderHook(() => useSubmitResult(roomId));
    const proposal = {
      type: "result_proposal" as const,
      roomId,
      winner: "0x0000000000000000000000000000000000000000" as `0x${string}`,
      outcome: OutcomeCode.Draw,
      reason: ReasonCode.Agreement,
      moveCount: moves.length,
      movesHash,
      nonce: 1,
      deadline,
    };

    await act(async () => {
      await submitResult.current.submit({
        proposal,
        relaySignature: relaySig,
        moves,
        white,
        black,
        seenEvents: sessionResult.current.seenEvents,
      });
    });

    expect(submitResult.current.step).toBe("confirmed");
    expect(submitResult.current.isSuccess).toBe(true);
  });

  it("populates moves and seenEvents from game_finished on reload without room_state", async () => {
    const finishedMoves = ["e2e4", "e7e5", "g1f3"];
    const movesHash = computeMovesHash(finishedMoves);
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    const { result: sessionResult } = renderHook(() => useRelaySession(roomId));

    act(() => {
      mockRelayClientInstance.finishedInfo = {
        roomId,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        winner: white,
        moveCount: finishedMoves.length,
        moves: finishedMoves,
      };
      mockRelayClientInstance.emit("gameFinished", {
        type: "game_finished",
        roomId,
        outcome: OutcomeCode.WhiteWin,
        reason: ReasonCode.Resign,
        winner: white,
        moveCount: finishedMoves.length,
        moves: finishedMoves,
      });
    });

    expect(sessionResult.current.moves).toEqual(finishedMoves);
    expect(sessionResult.current.seenEvents.resignSeen).toBe(true);

    const { result: submitResult } = renderHook(() => useSubmitResult(roomId));
    const proposal = {
      type: "result_proposal" as const,
      roomId,
      winner: white,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Resign,
      moveCount: finishedMoves.length,
      movesHash,
      nonce: 1,
      deadline,
    };

    await act(async () => {
      await submitResult.current.submit({
        proposal,
        relaySignature: relaySig,
        moves: sessionResult.current.moves,
        white,
        black,
        seenEvents: sessionResult.current.seenEvents,
      });
    });

    expect(submitResult.current.step).toBe("confirmed");
    expect(submitResult.current.isSuccess).toBe(true);
  });
});
