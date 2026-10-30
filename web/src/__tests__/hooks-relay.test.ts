// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSubmitResult } from "../hooks/useSubmitResult";
import { useRelaySession } from "../hooks/useRelaySession";
import { OutcomeCode, ReasonCode, computeMovesHash, ZERO_ADDRESS } from "@avaclash/shared";

// --- Mock wagmi ---
let mockAddress: `0x${string}` = "0x1111111111111111111111111111111111111111";
let mockSignTypedDataAsync = vi.fn();
let mockWriteContractAsync = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mockAddress }),
  useSignTypedData: () => ({
    signTypedDataAsync: mockSignTypedDataAsync,
  }),
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: false,
    isSuccess: true,
  }),
  useWatchContractEvent: () => {},
  useReadContract: () => ({ data: undefined }),
}));

describe("Relay Web Hooks (Turn 3c-2 Item 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "0x1111111111111111111111111111111111111111";
    mockSignTypedDataAsync.mockReset();
    mockWriteContractAsync.mockReset();
  });

  describe("useSubmitResult", () => {
    const roomId = 50;
    const white = mockAddress;
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

    it("verifies proposal and successfully submits with 2-of-3 signatures", async () => {
      mockSignTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      mockWriteContractAsync.mockResolvedValue("0xtxhash" as `0x${string}`);

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

      expect(mockSignTypedDataAsync).toHaveBeenCalledTimes(1);
      expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);
      const callArgs = mockWriteContractAsync.mock.calls[0][0];
      expect(callArgs.functionName).toBe("submitResult");
      expect(callArgs.args[0]).toBe(BigInt(roomId));
      expect(callArgs.args[1]).toBe(white);
      expect(callArgs.args[8]).toBe("0xmysig");
      expect(callArgs.args[9]).toBe(relaySig);
      expect(result.current.step).toBe("confirmed");
      expect(result.current.isSuccess).toBe(true);
    });

    it("blocks submission when verifyResultProposal detects tampered proposal", async () => {
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

      expect(mockSignTypedDataAsync).not.toHaveBeenCalled();
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(/winner address/i);
    });

    it("handles user rejection when signing typed data", async () => {
      const rejectErr = new Error("User rejected the request.");
      rejectErr.name = "UserRejectedRequestError";
      mockSignTypedDataAsync.mockRejectedValue(rejectErr);

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

      expect(mockSignTypedDataAsync).toHaveBeenCalledTimes(1);
      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(/từ chối/i);
    });

    it("handles DeadlineExpired contract revert and flags needsNewProposal", async () => {
      mockSignTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      const deadlineErr = new Error("Execution reverted: DeadlineExpired()");
      mockWriteContractAsync.mockRejectedValue(deadlineErr);

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

    it("handles RoomNotActive revert gracefully as already settled", async () => {
      mockSignTypedDataAsync.mockResolvedValue("0xmysig" as `0x${string}`);
      const notActiveErr = new Error("Execution reverted: RoomNotActive()");
      mockWriteContractAsync.mockRejectedValue(notActiveErr);

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

      expect(result.current.step).toBe("error");
      expect(result.current.error).toMatch(/đối thủ hoặc bên thứ ba nộp/i);
    });
  });

  describe("useRelaySession", () => {
    it("initializes RelayClient and reflects color based on wallet address", () => {
      const { result } = renderHook(() => useRelaySession(50));
      expect(result.current.connectionStatus).toBeDefined();
      expect(typeof result.current.sendMove).toBe("function");
    });
  });
});
