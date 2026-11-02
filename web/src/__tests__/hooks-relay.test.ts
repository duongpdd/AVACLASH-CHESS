// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OutcomeCode,
  ReasonCode,
  computeMovesHash,
  RelayClient,
  type RelayClientEventMap,
} from "@avaclash/shared";

const mocks = vi.hoisted(() => {
  let address: `0x${string}` | undefined =
    "0x1111111111111111111111111111111111111111";
  let receipt: { status: string } | undefined = { status: "success" };
  let isConfirming = false;
  const signTypedDataAsync = vi.fn();
  const writeContractAsync = vi.fn();

  return {
    getAddress: () => address,
    setAddress: (a: `0x${string}` | undefined) => {
      address = a;
    },
    getReceipt: () => receipt,
    setReceipt: (r: { status: string } | undefined) => {
      receipt = r;
    },
    getIsConfirming: () => isConfirming,
    setIsConfirming: (c: boolean) => {
      isConfirming = c;
    },
    signTypedDataAsync,
    writeContractAsync,
  };
});

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({ address: mocks.getAddress() }),
    useConnection: () => ({ address: mocks.getAddress() }),
    useConfig: () => ({}),
    useSignTypedData: () => ({
      signTypedDataAsync: mocks.signTypedDataAsync,
    }),
    useWriteContract: () => ({
      writeContractAsync: mocks.writeContractAsync,
      reset: vi.fn(),
    }),
    useWaitForTransactionReceipt: () => ({
      data: mocks.getReceipt(),
      isLoading: mocks.getIsConfirming(),
      isSuccess: mocks.getReceipt()?.status === "success",
    }),
    useWatchContractEvent: () => {},
    useReadContract: () => ({ data: undefined }),
  };
});

import { renderHook, act } from "@testing-library/react";
import { useSubmitResult } from "../hooks/useSubmitResult";
import { useRelaySession } from "../hooks/useRelaySession";

describe("Relay Web Hooks (Turn 3c-2 Item 3 & Turn 3c-2-fix Item 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.setAddress("0x1111111111111111111111111111111111111111");
    mocks.signTypedDataAsync.mockReset();
    mocks.writeContractAsync.mockReset();
    mocks.setReceipt({ status: "success" });
    mocks.setIsConfirming(false);
  });

  describe("useSubmitResult", () => {
    const roomId = 50;
    const white = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const black = "0x2222222222222222222222222222222222222222" as `0x${string}`;
    const moves = ["e2e4", "e7e5", "d1h5", "b8c6", "f1c4", "g8f6", "h5f7"]; // White checkmates
    const hash = computeMovesHash(moves);
    const deadline = Math.floor(Date.now() / 1000) + 1000;

    const validProposal = {
      type: "result_proposal" as const,
      roomId,
      winner: white,
      outcome: OutcomeCode.WhiteWin,
      reason: ReasonCode.Checkmate,
      moveCount: moves.length,
      movesHash: hash,
      nonce: 1,
      deadline,
    };
    const relaySig = ("0x" + "aa".repeat(65)) as `0x${string}`;

    it("verifies proposal and sets confirmed only when receipt status is success", async () => {
      mocks.signTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      mocks.writeContractAsync.mockResolvedValue("0xtxhash" as `0x${string}`);
      mocks.setReceipt({ status: "success" });

      const { result } = renderHook(() => useSubmitResult(roomId));
      expect(result.current.step).toBe("idle");

      await act(async () => {
        await result.current.submit({
          proposal: validProposal,
          relaySignature: relaySig,
          moves,
          white,
          black,
        });
      });

      expect(mocks.signTypedDataAsync).toHaveBeenCalledTimes(1);
      expect(mocks.writeContractAsync).toHaveBeenCalledTimes(1);
      expect(result.current.step).toBe("confirmed");
      expect(result.current.isSuccess).toBe(true);
    });

    it("handles transaction receipt reverted with Vietnamese message and explorer suggestion", async () => {
      mocks.signTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      mocks.writeContractAsync.mockResolvedValue(
        "0xrevertedtx" as `0x${string}`,
      );
      mocks.setReceipt({ status: "reverted" });

      const { result } = renderHook(() => useSubmitResult(roomId));

      await act(async () => {
        await result.current.submit({
          proposal: validProposal,
          relaySignature: relaySig,
          moves,
          white,
          black,
        });
      });

      expect(mocks.signTypedDataAsync).toHaveBeenCalledTimes(1);
      expect(mocks.writeContractAsync).toHaveBeenCalledTimes(1);
      expect(result.current.step).toBe("error");
      expect(result.current.isSuccess).toBe(false);
      expect(result.current.error).toMatch(/reverted.*Explorer/i);
    });

    it("does NOT call signTypedDataAsync or writeContractAsync when verify fails", async () => {
      const tamperedProposal = {
        ...validProposal,
        winner: black, // Falsely claiming black won!
      };

      const { result } = renderHook(() => useSubmitResult(roomId));

      await act(async () => {
        await result.current.submit({
          proposal: tamperedProposal,
          relaySignature: relaySig,
          moves,
          white,
          black,
        });
      });

      expect(mocks.signTypedDataAsync).toHaveBeenCalledTimes(0);
      expect(mocks.writeContractAsync).toHaveBeenCalledTimes(0);
      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(/winner address/i);
    });

    it("handles user rejection when signing typed data and does NOT call writeContractAsync", async () => {
      const rejectErr = new Error("User rejected the request.");
      rejectErr.name = "UserRejectedRequestError";
      mocks.signTypedDataAsync.mockRejectedValue(rejectErr);

      const { result } = renderHook(() => useSubmitResult(roomId));

      await act(async () => {
        await result.current.submit({
          proposal: validProposal,
          relaySignature: relaySig,
          moves,
          white,
          black,
        });
      });

      expect(mocks.signTypedDataAsync).toHaveBeenCalledTimes(1);
      expect(mocks.writeContractAsync).toHaveBeenCalledTimes(0);
      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(/từ chối/i);
    });

    it("automatically triggers onRequestNewResult when error code is DeadlineExpired", async () => {
      mocks.signTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      const deadlineErr = {
        name: "ContractFunctionExecutionError",
        shortMessage: "The contract function reverted: DeadlineExpired()",
        message: "Execution reverted with reason: DeadlineExpired()",
        data: { errorName: "DeadlineExpired" },
      };
      mocks.writeContractAsync.mockRejectedValue(deadlineErr);

      const onRequestNewResult = vi.fn();
      const { result } = renderHook(() => useSubmitResult(roomId));

      await act(async () => {
        await result.current.submit({
          proposal: validProposal,
          relaySignature: relaySig,
          moves,
          white,
          black,
          onRequestNewResult,
        });
      });

      expect(result.current.step).toBe("error");
      expect(result.current.needsNewProposal).toBe(true);
      expect(onRequestNewResult).toHaveBeenCalledTimes(1);
    });

    it("refetches room on RoomNotActive; displays 'Đã được nộp' and updates balance if already settled", async () => {
      mocks.signTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      const notActiveErr = {
        name: "ContractFunctionExecutionError",
        shortMessage: "The contract function reverted: RoomNotActive()",
        message: "Execution reverted with reason: RoomNotActive()",
        data: { errorName: "RoomNotActive" },
      };
      mocks.writeContractAsync.mockRejectedValue(notActiveErr);

      const refetchRoom = vi.fn().mockResolvedValue({ status: 2 }); // Status 2 = Settled
      const refetchBalance = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useSubmitResult(roomId));

      await act(async () => {
        await result.current.submit({
          proposal: validProposal,
          relaySignature: relaySig,
          moves,
          white,
          black,
          refetchRoom,
          refetchBalance,
        });
      });

      expect(refetchRoom).toHaveBeenCalledTimes(1);
      expect(refetchBalance).toHaveBeenCalledTimes(1);
      expect(result.current.step).toBe("confirmed");
      expect(result.current.isSuccess).toBe(true);
      expect(result.current.statusMessage).toBe("Đã được nộp");
      expect(result.current.error).toBeNull();
    });
  });

  describe("useRelaySession", () => {
    it("initializes RelayClient and reflects color based on wallet address", () => {
      const { result } = renderHook(() => useRelaySession(50));
      expect(result.current.connectionStatus).toBeDefined();
      expect(typeof result.current.sendMove).toBe("function");
    });

    it("does not re-instantiate RelayClient or reconnect when signTypedDataAsync identity changes across re-renders (Turn 3c-4 Item 5)", () => {
      const connectSpy = vi
        .spyOn(RelayClient.prototype, "connect")
        .mockImplementation(() => {});
      const disconnectSpy = vi
        .spyOn(RelayClient.prototype, "disconnect")
        .mockImplementation(() => {});

      mocks.signTypedDataAsync = vi.fn();
      const { rerender } = renderHook(() => useRelaySession(50));
      expect(connectSpy).toHaveBeenCalledTimes(1);

      // Re-render multiple times with new function identities for signTypedDataAsync
      mocks.signTypedDataAsync = vi.fn();
      rerender();
      mocks.signTypedDataAsync = vi.fn();
      rerender();
      mocks.signTypedDataAsync = vi.fn();
      rerender();

      // Before fix: effect re-ran every time, calling connect 4 times and disconnect 3 times
      // With signTypedDataAsync in ref: connect is called exactly 1 time
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(disconnectSpy).toHaveBeenCalledTimes(0);
    });

    it("(a) does NOT open socket when mounted with undefined address; opens exactly 1 socket when address appears (Turn 3c-5 Item 1)", () => {
      const connectSpy = vi
        .spyOn(RelayClient.prototype, "connect")
        .mockImplementation(() => {});
      vi.spyOn(RelayClient.prototype, "disconnect").mockImplementation(
        () => {},
      );

      mocks.setAddress(undefined);
      const { rerender } = renderHook(() => useRelaySession(50));

      // Should NOT open socket when address is undefined
      expect(connectSpy).toHaveBeenCalledTimes(0);

      // Address appears -> should open exactly 1 socket
      mocks.setAddress("0x1111111111111111111111111111111111111111");
      rerender();

      expect(connectSpy).toHaveBeenCalledTimes(1);
    });

    it("(b) re-render with new signTypedDataAsync does not open additional sockets (Turn 3c-5 Item 1)", () => {
      const connectSpy = vi
        .spyOn(RelayClient.prototype, "connect")
        .mockImplementation(() => {});
      const disconnectSpy = vi
        .spyOn(RelayClient.prototype, "disconnect")
        .mockImplementation(() => {});

      mocks.setAddress("0x1111111111111111111111111111111111111111");
      mocks.signTypedDataAsync = vi.fn();
      const { rerender } = renderHook(() => useRelaySession(50));
      expect(connectSpy).toHaveBeenCalledTimes(1);

      mocks.signTypedDataAsync = vi.fn();
      rerender();
      mocks.signTypedDataAsync = vi.fn();
      rerender();

      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(disconnectSpy).toHaveBeenCalledTimes(0);
    });

    it("(c) changing address closes old socket and opens new socket (Turn 3c-5 Item 1)", () => {
      const connectSpy = vi
        .spyOn(RelayClient.prototype, "connect")
        .mockImplementation(() => {});
      const disconnectSpy = vi
        .spyOn(RelayClient.prototype, "disconnect")
        .mockImplementation(() => {});

      mocks.setAddress("0x1111111111111111111111111111111111111111");
      const { rerender } = renderHook(() => useRelaySession(50));
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(disconnectSpy).toHaveBeenCalledTimes(0);

      // Address changes to new wallet
      mocks.setAddress("0x2222222222222222222222222222222222222222");
      rerender();

      // Old socket disconnected and new socket connected
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      expect(connectSpy).toHaveBeenCalledTimes(2);
    });

    it("returns error with incrementing id on repeated errors and provides clearError (Turn 3c-5 Item 2)", () => {
      let errorHandler: ((err: { message: string }) => void) | undefined;
      vi.spyOn(RelayClient.prototype, "on").mockImplementation(
        (event, handler) => {
          if (event === "error")
            errorHandler = handler as (err: { message: string }) => void;
          return () => {};
        },
      );

      mocks.setAddress("0x1111111111111111111111111111111111111111");
      const { result } = renderHook(() => useRelaySession(50));

      expect(result.current.error).toBeNull();

      act(() => {
        errorHandler?.({ message: "Nước đi không hợp lệ" });
      });

      expect(result.current.error).toEqual({
        message: "Nước đi không hợp lệ",
        id: 1,
      });

      // Same error message emitted again
      act(() => {
        errorHandler?.({ message: "Nước đi không hợp lệ" });
      });

      expect(result.current.error).toEqual({
        message: "Nước đi không hợp lệ",
        id: 2,
      });

      // clearError clears the error
      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

    it("clears terminal state and moves when the room changes", () => {
      let roomStateHandler: RelayClientEventMap["roomState"] | undefined;
      let finishedHandler: RelayClientEventMap["gameFinished"] | undefined;
      vi.spyOn(RelayClient.prototype, "connect").mockImplementation(() => {});
      vi.spyOn(RelayClient.prototype, "on").mockImplementation(
        (event, listener) => {
          if (event === "roomState")
            roomStateHandler = listener as RelayClientEventMap["roomState"];
          if (event === "gameFinished")
            finishedHandler = listener as RelayClientEventMap["gameFinished"];
          return () => {};
        },
      );
      const { result, rerender } = renderHook(({ id }) => useRelaySession(id), {
        initialProps: { id: 5000 },
      });
      act(() => {
        roomStateHandler?.({
          type: "room_state",
          roomId: 5000,
          white: "0x1111111111111111111111111111111111111111",
          black: "0x2222222222222222222222222222222222222222",
          moves: ["e2e4"],
          whiteMs: 200000,
          blackMs: 300000,
          status: "active",
        });
        finishedHandler?.({
          type: "game_finished",
          roomId: 5000,
          moves: ["e2e4"],
          reason: "resign",
        });
      });
      expect(result.current.gameFinished).toBe(true);
      expect(result.current.moves).toEqual(["e2e4"]);
      rerender({ id: 5001 });
      expect(result.current.gameFinished).toBe(false);
      expect(result.current.moves).toEqual([]);
      expect(result.current.roomState).toBeUndefined();
      expect(result.current.seenEvents).toEqual({});
      expect(result.current.resultProposal).toBeNull();
      expect(result.current.relaySignature).toBeNull();
    });
  });
});
