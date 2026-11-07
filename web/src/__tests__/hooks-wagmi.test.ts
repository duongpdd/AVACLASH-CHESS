// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@/test/render";
import {
  type Address,
  parseEther,
  encodeEventTopics,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { CHESS_ESCROW_ABI } from "@avaclash/shared";
import { useCreateRoom } from "../hooks/use-create-room";
import { useJoinRoom } from "../hooks/use-join-room";
import { useWithdraw } from "../hooks/use-withdraw";

// --- Mock state variables for wagmi ---
let mockAddress: string | undefined =
  "0x1111111111111111111111111111111111111111";
let mockMinStake = parseEther("0.01");
let mockMaxStake = parseEther("1.0");
let mockNextRoomId = BigInt(10);
let mockRoomData: {
  playerA: string;
  playerB?: string;
  stake: bigint;
  status: number;
  creatorIsWhite: boolean;
} | null = null;
let mockPendingBalance = BigInt(0);

const mockWriteContractAsync = vi.fn();
const mockResetWrite = vi.fn();
let mockTxHash: `0x${string}` | undefined = undefined;

let mockReceipt: { status: string; logs?: unknown[] } | null = null;
let mockIsConfirming = false;
let mockIsSuccess = false;

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mockAddress }),
  useReadContract: ({ functionName }: { functionName: string }) => {
    if (functionName === "MIN_STAKE") return { data: mockMinStake };
    if (functionName === "MAX_STAKE") return { data: mockMaxStake };
    if (functionName === "nextRoomId") return { data: mockNextRoomId };
    if (functionName === "getRoom") return { data: mockRoomData };
    if (functionName === "pendingWithdrawals")
      return { data: mockPendingBalance };
    return { data: undefined };
  },
  useWriteContract: () => ({
    writeContractAsync: mockWriteContractAsync,
    reset: mockResetWrite,
    data: mockTxHash,
  }),
  useWaitForTransactionReceipt: () => ({
    isLoading: mockIsConfirming,
    isSuccess: mockIsSuccess,
    data: mockReceipt,
  }),
  useWatchContractEvent: () => {},
}));

describe("Web3 Hooks Unit Tests with Wagmi Mocking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress = "0x1111111111111111111111111111111111111111";
    mockMinStake = parseEther("0.01");
    mockMaxStake = parseEther("1.0");
    mockNextRoomId = BigInt(10);
    mockRoomData = null;
    mockPendingBalance = BigInt(0);

    mockTxHash = undefined;
    mockReceipt = null;
    mockIsConfirming = false;
    mockIsSuccess = false;
  });

  describe("useCreateRoom", () => {
    it("handles round 1 create room, resets step and write state cleanly, and handles round 2 with event parsing", async () => {
      mockWriteContractAsync.mockResolvedValue("0x1111");
      mockTxHash = "0x1111";

      const { result, rerender } = renderHook(() => useCreateRoom());
      expect(result.current.step).toBe("idle");
      expect(result.current.createdRoomId).toBeNull();

      // --- Round 1 ---
      await act(async () => {
        await result.current.createRoom(true, "0.05");
      });
      expect(mockWriteContractAsync).toHaveBeenCalledTimes(1);

      // Simulate receipt mined with RoomCreated event (roomId = 42)
      const topics1 = encodeEventTopics({
        abi: CHESS_ESCROW_ABI,
        eventName: "RoomCreated",
        args: { roomId: BigInt(42), creator: mockAddress as Address },
      });
      const data1 = encodeAbiParameters(
        parseAbiParameters("uint256 stake, bool creatorIsWhite"),
        [parseEther("0.05"), true],
      );

      mockReceipt = {
        status: "success",
        logs: [
          {
            address: "0x54101e4a2d3c9071c775efcf4bbbeea8dc5057a1",
            topics: topics1,
            data: data1,
          },
        ],
      };
      mockIsSuccess = true;
      rerender();

      expect(result.current.step).toBe("success");
      expect(result.current.createdRoomId).toBe(BigInt(42));

      // Reset hook
      act(() => {
        result.current.reset();
      });
      expect(mockResetWrite).toHaveBeenCalled();

      // Simulate cleared write state after reset
      mockTxHash = undefined;
      mockReceipt = null;
      mockIsSuccess = false;
      rerender();

      expect(result.current.step).toBe("idle");
      expect(result.current.createdRoomId).toBeNull();

      // --- Round 2 ---
      mockWriteContractAsync.mockResolvedValue("0x2222");
      mockTxHash = "0x2222";

      await act(async () => {
        await result.current.createRoom(false, "0.08");
      });
      expect(mockWriteContractAsync).toHaveBeenCalledTimes(2);

      // Simulate receipt mined with RoomCreated event (roomId = 43)
      const topics2 = encodeEventTopics({
        abi: CHESS_ESCROW_ABI,
        eventName: "RoomCreated",
        args: { roomId: BigInt(43), creator: mockAddress as Address },
      });
      const data2 = encodeAbiParameters(
        parseAbiParameters("uint256 stake, bool creatorIsWhite"),
        [parseEther("0.08"), false],
      );

      mockReceipt = {
        status: "success",
        logs: [
          {
            address: "0x54101e4a2d3c9071c775efcf4bbbeea8dc5057a1",
            topics: topics2,
            data: data2,
          },
        ],
      };
      mockIsSuccess = true;
      rerender();

      expect(result.current.step).toBe("success");
      expect(result.current.createdRoomId).toBe(BigInt(43));
    });

    it("displays error with explorer hint when receipt status is reverted", async () => {
      mockWriteContractAsync.mockResolvedValue("0x1111");
      mockTxHash = "0x1111";

      const { result, rerender } = renderHook(() => useCreateRoom());

      await act(async () => {
        await result.current.createRoom(true, "0.05");
      });

      // Receipt returned with reverted status
      mockReceipt = {
        status: "reverted",
        logs: [],
      };
      mockIsSuccess = true;
      rerender();

      expect(result.current.step).toBe("error");
      expect(result.current.errorMessage).toContain("reverted");
      expect(result.current.errorMessage).toContain("Explorer");
    });

    it("sets step to error and decodes message when user rejects in wallet", async () => {
      const rejectError = new Error("User rejected the request.");
      rejectError.name = "UserRejectedRequestError";
      mockWriteContractAsync.mockRejectedValue(rejectError);

      const { result } = renderHook(() => useCreateRoom());

      await act(async () => {
        try {
          await result.current.createRoom(true, "0.05");
        } catch {}
      });

      expect(result.current.step).toBe("error");
      expect(result.current.errorMessage).toBe(
        "Giao dịch đã bị từ chối từ ví.",
      );
    });
  });

  describe("useJoinRoom", () => {
    it("does not call writeContract when attempting to join a non-existent room", async () => {
      mockNextRoomId = BigInt(5);
      mockRoomData = null; // non-existent room (or playerA = address(0))

      const { result } = renderHook(() => useJoinRoom(BigInt(99)));

      expect(result.current.exists).toBe(false);
      expect(result.current.joinable).toBe(false);

      await act(async () => {
        await result.current.joinRoom(BigInt(99));
      });

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(result.current.step).toBe("error");
      expect(result.current.errorMessage).toBe("Phòng không tồn tại");
    });

    it("does not call writeContract if room stake is zero", async () => {
      mockNextRoomId = BigInt(10);
      mockRoomData = {
        playerA: "0x3333333333333333333333333333333333333333",
        stake: BigInt(0),
        status: 0,
        creatorIsWhite: true,
      };

      const { result } = renderHook(() => useJoinRoom(BigInt(2)));

      await act(async () => {
        await result.current.joinRoom(BigInt(2));
      });

      expect(mockWriteContractAsync).not.toHaveBeenCalled();
      expect(result.current.step).toBe("error");
      expect(result.current.errorMessage).toContain("Mức cược");
    });

    it("displays error with explorer hint when join receipt is reverted", async () => {
      mockNextRoomId = BigInt(10);
      mockRoomData = {
        playerA: "0x3333333333333333333333333333333333333333",
        stake: parseEther("0.05"),
        status: 0,
        creatorIsWhite: true,
      };
      mockWriteContractAsync.mockResolvedValue("0xjoin");
      mockTxHash = "0xjoin";

      const { result, rerender } = renderHook(() => useJoinRoom(BigInt(2)));

      await act(async () => {
        await result.current.joinRoom(BigInt(2));
      });

      mockReceipt = {
        status: "reverted",
        logs: [],
      };
      mockIsSuccess = true;
      rerender();

      expect(result.current.step).toBe("error");
      expect(result.current.errorMessage).toContain("reverted");
      expect(result.current.errorMessage).toContain("Explorer");
    });
  });

  describe("useWithdraw", () => {
    it("handles reverted receipt on withdraw gracefully", async () => {
      mockPendingBalance = parseEther("0.1");
      mockWriteContractAsync.mockResolvedValue("0xwithdraw");
      mockTxHash = "0xwithdraw";

      const { result, rerender } = renderHook(() => useWithdraw());

      await act(async () => {
        await result.current.withdraw();
      });

      mockReceipt = {
        status: "reverted",
        logs: [],
      };
      mockIsSuccess = true;
      rerender();

      expect(result.current.step).toBe("error");
      expect(result.current.errorMessage).toContain("reverted");
      expect(result.current.errorMessage).toContain("Explorer");
    });
  });
});
