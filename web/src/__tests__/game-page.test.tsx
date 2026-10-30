// @vitest-environment happy-dom
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import GamePage from "../app/game/page";

const {
  getMockAddress,
  setMockAddress,
  getMockChainId,
  setMockChainId,
  getMockRoomData,
  setMockRoomData,
  MockRelayClient,
  getMockRelayClientInstance,
  mockSignTypedDataAsync,
  mockWriteContractAsync,
} = vi.hoisted(() => {
  let address: `0x${string}` | undefined = "0x1111111111111111111111111111111111111111";
  let chainId = 43113;
  let roomData: any = {
    playerA: "0x1111111111111111111111111111111111111111",
    playerB: "0x2222222222222222222222222222222222222222",
    stake: BigInt("100000000000000000"), // 0.1 AVAX
    status: 1, // Active
    creatorIsWhite: true,
    gameStarted: false,
    joinedAt: BigInt(1000),
  };
  let instance: any = null;
  const mockSignTypedDataAsync = vi.fn();
  const mockWriteContractAsync = vi.fn().mockResolvedValue("0xhash");

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
    getFinishedInfo = vi.fn().mockReturnValue(undefined);
  }

  return {
    getMockAddress: () => address,
    setMockAddress: (a: `0x${string}` | undefined) => {
      address = a;
    },
    getMockChainId: () => chainId,
    setMockChainId: (c: number) => {
      chainId = c;
    },
    getMockRoomData: () => roomData,
    setMockRoomData: (r: any) => {
      roomData = r;
    },
    MockRelayClient,
    getMockRelayClientInstance: () => instance,
    mockSignTypedDataAsync,
    mockWriteContractAsync,
  };
});

// Mock next/navigation
let mockSearchParams = new URLSearchParams();
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
      chainId: getMockChainId(),
    }),
    useChainId: () => getMockChainId(),
    useReadContract: ({ functionName }: any) => {
      if (functionName === "getRoom") {
        return {
          data: getMockRoomData(),
          refetch: vi.fn(),
        };
      }
      if (functionName === "nextRoomId") return { data: BigInt(100) };
      if (functionName === "pendingWithdrawals") return { data: BigInt("190000000000000000") }; // 0.19 AVAX
      return { data: undefined };
    },
    useWriteContract: () => ({
      writeContractAsync: mockWriteContractAsync,
      reset: vi.fn(),
    }),
    useWaitForTransactionReceipt: () => ({
      isLoading: false,
      isSuccess: false,
    }),
    useWatchContractEvent: () => {},
    useSignTypedData: () => ({
      signTypedDataAsync: mockSignTypedDataAsync,
    }),
  };
});

vi.mock("@avaclash/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@avaclash/shared")>();
  return {
    ...actual,
    RelayClient: MockRelayClient,
  };
});

describe("GamePage Online Mode Component Tests (Turn 3c-2-fix Item 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    setMockAddress("0x1111111111111111111111111111111111111111");
    setMockChainId(43113);
    setMockRoomData({
      playerA: "0x1111111111111111111111111111111111111111",
      playerB: "0x2222222222222222222222222222222222222222",
      stake: BigInt("100000000000000000"),
      status: 1, // Active
      creatorIsWhite: true,
      gameStarted: false,
      joinedAt: BigInt(1000),
    });
  });

  it("renders guide when roomId param is missing from URL", () => {
    render(<GamePage />);
    expect(screen.getByRole("heading", { name: /Chưa chọn phòng thi đấu/i })).toBeDefined();
  });

  it("displays instructions when wallet is not connected", () => {
    mockSearchParams.set("room", "42");
    setMockAddress(undefined);
    render(<GamePage />);
    expect(screen.getByRole("heading", { name: /Yêu cầu kết nối ví/i })).toBeDefined();
    expect(screen.getByText(/Bạn cần kết nối ví Web3/i)).toBeDefined();
  });

  it("displays wrong network warning when chainId is incorrect", () => {
    mockSearchParams.set("room", "42");
    setMockChainId(1); // Chain 1 (Ethereum Mainnet), target is 43113
    render(<GamePage />);
    expect(screen.getByRole("heading", { name: /Sai mạng kết nối/i })).toBeDefined();
    expect(screen.getByText(/Ví của bạn đang kết nối vào Chain ID/i)).toBeDefined();
  });

  it("displays reconnecting status banner when relay is reconnecting", () => {
    mockSearchParams.set("room", "42");
    render(<GamePage />);
    const client = getMockRelayClientInstance();
    expect(client).toBeDefined();
    act(() => {
      client.emit("connectionStatus", "reconnecting");
    });
    expect(screen.getByText(/Đang kết nối lại với máy chủ relay.../i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Thử lại ngay/i })).toBeDefined();
  });

  it("displays '(Lượt của bạn)' when it is user's turn", () => {
    mockSearchParams.set("room", "42");
    render(<GamePage />);
    const client = getMockRelayClientInstance();
    act(() => {
      client.emit("roomState", {
        type: "room_state",
        roomId: 42,
        white: "0x1111111111111111111111111111111111111111",
        black: "0x2222222222222222222222222222222222222222",
        moves: [],
        whiteMs: 300000,
        blackMs: 300000,
        status: "active",
      });
    });
    expect(screen.getByText(/\(Lượt của bạn\)/i)).toBeDefined();
  });

  it("displays 'Lấy chữ ký kết quả từ Relay' button when game_finished is received but proposal not yet available", () => {
    mockSearchParams.set("room", "42");
    render(<GamePage />);
    const client = getMockRelayClientInstance();
    act(() => {
      client.emit("gameFinished", {
        type: "game_finished",
        roomId: 42,
        outcome: 0,
        reason: "checkmate",
        winner: "0x1111111111111111111111111111111111111111",
        moveCount: 4,
      });
    });
    const requestBtn = screen.getByRole("button", { name: /Lấy chữ ký kết quả từ Relay/i });
    expect(requestBtn).toBeDefined();
    fireEvent.click(requestBtn);
    expect(client.requestResult).toHaveBeenCalled();
  });

  it("displays 'Ký & Nộp kết quả (2-trong-3)' button when result proposal and relay signature are present", () => {
    mockSearchParams.set("room", "42");
    render(<GamePage />);
    const client = getMockRelayClientInstance();
    act(() => {
      client.emit("gameFinished", {
        type: "game_finished",
        roomId: 42,
        outcome: 0,
        reason: "checkmate",
        winner: "0x1111111111111111111111111111111111111111",
        moveCount: 4,
      });
      client.emit("resultProposal", {
        type: "result_proposal",
        roomId: 42,
        outcome: 0,
        reason: 0,
        winner: "0x1111111111111111111111111111111111111111",
        moveCount: 4,
        movesHash: "0x1234567890123456789012345678901234567890123456789012345678901234",
        nonce: 1,
        deadline: 9999999999,
      });
      client.emit("resultSignature", {
        type: "result_signature",
        signature: "0xabcdef1234567890",
      });
    });
    expect(screen.getByRole("button", { name: /Ký & Nộp kết quả \(2-trong-3\)/i })).toBeDefined();
  });

  it("AbortRefundWidget countdown and buttons transition correctly at 3m and 60m with fake timers", () => {
    vi.useFakeTimers();
    const startTimeSec = 10000;
    vi.setSystemTime(startTimeSec * 1000);

    setMockRoomData({
      playerA: "0x1111111111111111111111111111111111111111",
      playerB: "0x2222222222222222222222222222222222222222",
      stake: BigInt("100000000000000000"),
      status: 1, // Active
      creatorIsWhite: true,
      gameStarted: false,
      joinedAt: BigInt(startTimeSec),
    });

    mockSearchParams.set("room", "42");
    render(<GamePage />);

    // At t=0: abort is 3 minutes (3:00), refund is 60 minutes (60:00)
    expect(screen.getByText("3:00")).toBeDefined();
    expect(screen.getByText("60:00")).toBeDefined();
    const abortBtn = screen.getByRole("button", { name: /Hủy phòng \(abortRoom\)/i });
    const refundBtn = screen.getByRole("button", { name: /Hoàn tiền \(refundOnTimeout\)/i });
    expect((abortBtn as HTMLButtonElement).disabled).toBe(true);
    expect((refundBtn as HTMLButtonElement).disabled).toBe(true);

    // Fast-forward 180s (3 minutes)
    act(() => {
      vi.advanceTimersByTime(180_000);
    });

    expect(screen.getAllByText("Sẵn sàng").length).toBeGreaterThanOrEqual(1);
    expect((abortBtn as HTMLButtonElement).disabled).toBe(false);
    expect((refundBtn as HTMLButtonElement).disabled).toBe(true);

    // Fast-forward another 3420s (total 3600s / 60 minutes)
    act(() => {
      vi.advanceTimersByTime(3420_000);
    });

    expect(screen.getAllByText("Sẵn sàng").length).toBe(2);
    expect((abortBtn as HTMLButtonElement).disabled).toBe(false);
    expect((refundBtn as HTMLButtonElement).disabled).toBe(false);

    vi.useRealTimers();
  });
});
