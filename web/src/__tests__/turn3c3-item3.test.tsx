// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, fireEvent, cleanup } from "@testing-library/react";
import GamePage from "../app/game/page";
import { decodeContractError, ERROR_MESSAGES } from "../utils/errors";

const {
  getMockAddress,
  setMockAddress,
  getMockRoomData,
  setMockRoomData,
  MockRelayClient,
  getMockRelayClientInstance,
} = vi.hoisted(() => {
  let address: `0x${string}` | undefined = "0x1111111111111111111111111111111111111111";
  let roomData: any = {
    playerA: "0x1111111111111111111111111111111111111111",
    playerB: "0x2222222222222222222222222222222222222222",
    stake: BigInt("100000000000000000"), // 0.1 AVAX
    status: 1, // Active
    creatorIsWhite: true,
    gameStarted: true,
    joinedAt: BigInt(1000),
  };
  let instance: any = null;

  class MockRelayClient {
    public listeners: Record<string, Function[]> = {};
    public status: string = "connected";
    public lastRoomId?: number;

    constructor(options: any) {
      instance = this;
    }

    on(event: string, fn: Function) {
      if (!this.listeners[event]) this.listeners[event] = [];
      this.listeners[event].push(fn);
      return () => {
        this.listeners[event] = this.listeners[event].filter((f) => f !== fn);
      };
    }

    emit(event: string, ...args: any[]) {
      this.listeners[event]?.forEach((fn) => fn(...args));
    }

    connect(roomId: number) {
      this.lastRoomId = roomId;
      this.status = "connected";
      this.emit("connectionStatus", "connected");
    }

    disconnect() {
      this.status = "disconnected";
      this.emit("connectionStatus", "disconnected");
    }

    sendMove = vi.fn();
    sendResign = vi.fn();
    sendDrawOffer = vi.fn();
    sendDrawAccept = vi.fn();
    sendDrawDecline = vi.fn();
    sendTimeout = vi.fn();
    requestResult = vi.fn();
    sendFocusWarning = vi.fn();
    getSeenEvents = vi.fn().mockReturnValue({});
    getSeenTerminalEvents = vi.fn().mockReturnValue({});
    getFinishedInfo = vi.fn().mockReturnValue(undefined);
    getRoomState = vi.fn().mockReturnValue(undefined);
  }

  return {
    getMockAddress: () => address,
    setMockAddress: (a: `0x${string}` | undefined) => {
      address = a;
    },
    getMockRoomData: () => roomData,
    setMockRoomData: (r: any) => {
      roomData = r;
    },
    MockRelayClient,
    getMockRelayClientInstance: () => instance,
  };
});

// Mock next/navigation
let mockSearchParams = new URLSearchParams("room=10");
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
}));

// Mock dynamic Phaser component
vi.mock("next/dynamic", () => ({
  default: () => {
    return function MockPhaserGame(props: any) {
      return <div data-testid="mock-phaser-game" />;
    };
  },
}));

vi.mock("../components/WalletBar", () => ({
  default: () => <div data-testid="mock-wallet-bar">Mock WalletBar</div>,
}));

// Mock wagmi
vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({
      address: getMockAddress(),
      isConnected: !!getMockAddress(),
      chainId: 43113,
    }),
    useChainId: () => 43113,
    useConnection: () => ({
      address: getMockAddress(),
      isConnected: !!getMockAddress(),
    }),
    useConfig: () => ({}),
    useSignTypedData: () => ({
      signTypedDataAsync: vi.fn(),
    }),
    useWriteContract: () => ({
      writeContractAsync: vi.fn().mockResolvedValue("0xtx"),
      reset: vi.fn(),
    }),
    useWaitForTransactionReceipt: () => ({
      isLoading: false,
      isSuccess: false,
      data: undefined,
    }),
    useWatchContractEvent: () => {},
    useReadContract: ({ functionName }: { functionName: string }) => {
      if (functionName === "getRoom") {
        return {
          data: getMockRoomData(),
          isLoading: false,
          refetch: vi.fn().mockResolvedValue(getMockRoomData()),
        };
      }
      if (functionName === "pendingWithdrawals") {
        return {
          data: BigInt("50000000000000000"), // 0.05 AVAX
          refetch: vi.fn(),
        };
      }
      return { data: undefined, isLoading: false };
    },
  };
});

// Mock RelayClient
vi.mock("@avaclash/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avaclash/shared")>();
  return {
    ...actual,
    RelayClient: MockRelayClient,
  };
});

describe("Turn 3c-3 Item 3: Small fixes & UI safeguards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setMockAddress("0x1111111111111111111111111111111111111111");
  });

  afterEach(() => {
    cleanup();
  });

  describe("Room Status Safeguard: Cancelled (3), Refunded (4), Aborted (6)", () => {
    it("displays 'Phòng đã hủy/hoàn tiền' instead of 'Ván Đã Kết Thúc' and hides signature request button when status is Cancelled (3)", async () => {
      setMockRoomData({
        playerA: "0x1111111111111111111111111111111111111111",
        playerB: "0x2222222222222222222222222222222222222222",
        stake: BigInt("100000000000000000"),
        status: 3, // Cancelled
        creatorIsWhite: true,
        gameStarted: false,
      });

      render(<GamePage />);

      // Should display "Phòng đã hủy/hoàn tiền"
      expect(screen.getByText(/Phòng đã hủy\/hoàn tiền/i)).toBeDefined();

      // Should NOT display "Ván Đã Kết Thúc" or signature request button
      expect(screen.queryByText(/Ván Đã Kết Thúc/i)).toBeNull();
      expect(screen.queryByText(/Lấy chữ ký kết quả từ Relay/i)).toBeNull();
      expect(screen.queryByText(/Ký & Nộp kết quả/i)).toBeNull();
    });

    it("displays 'Phòng đã hủy/hoàn tiền' for Refunded (4) and Aborted (6) statuses", async () => {
      // Test status 4 (Refunded)
      setMockRoomData({
        playerA: "0x1111111111111111111111111111111111111111",
        playerB: "0x2222222222222222222222222222222222222222",
        stake: BigInt("100000000000000000"),
        status: 4, // Refunded
        creatorIsWhite: true,
        gameStarted: true,
      });

      const { rerender } = render(<GamePage />);
      expect(screen.getByText(/Phòng đã hủy\/hoàn tiền/i)).toBeDefined();
      expect(screen.queryByText(/Ván Đã Kết Thúc/i)).toBeNull();

      // Test status 6 (Aborted)
      setMockRoomData({
        playerA: "0x1111111111111111111111111111111111111111",
        playerB: "0x2222222222222222222222222222222222222222",
        stake: BigInt("100000000000000000"),
        status: 6, // Aborted
        creatorIsWhite: true,
        gameStarted: false,
      });

      rerender(<GamePage />);
      expect(screen.getByText(/Phòng đã hủy\/hoàn tiền/i)).toBeDefined();
      expect(screen.queryByText(/Ván Đã Kết Thúc/i)).toBeNull();
    });
  });

  describe("Focus warning text and relay notification (Q10)", () => {
    it("updates focus alert text to fair-play warning (no clock deduction) and sends focus_warning to relay", async () => {
      setMockRoomData({
        playerA: "0x1111111111111111111111111111111111111111",
        playerB: "0x2222222222222222222222222222222222222222",
        stake: BigInt("100000000000000000"),
        status: 1, // Active
        creatorIsWhite: true,
        gameStarted: true,
      });

      render(<GamePage />);

      // Trigger window blur event
      act(() => {
        window.dispatchEvent(new Event("blur"));
      });

      // Banner must NOT mention "tính giờ"
      const alertElem = screen.getByText(/Cảnh báo|rời khỏi màn hình/i);
      expect(alertElem).toBeDefined();
      expect(alertElem.textContent).not.toMatch(/tính giờ cờ chớp/i);
      expect(alertElem.textContent).toMatch(/fair-play|tập trung/i);

      // Must call sendFocusWarning on RelayClient
      const relay = getMockRelayClientInstance();
      expect(relay.sendFocusWarning).toHaveBeenCalled();
    });
  });

  describe("decodeContractError ensures string error message in all call sites", () => {
    it("ensures decodeContractError produces primitive string messages matching ERROR_MESSAGES", () => {
      const err = {
        name: "ContractFunctionExecutionError",
        shortMessage: "The contract function reverted: InsufficientBond()",
        message: "Execution reverted with reason: InsufficientBond()",
      };
      const decoded = decodeContractError(err);
      expect(typeof decoded.message).toBe("string");
      expect(decoded.message).toBe(ERROR_MESSAGES.InsufficientBond);
    });
  });
});
