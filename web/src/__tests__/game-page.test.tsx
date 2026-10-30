// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import GamePage from "../app/game/page";

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
let mockAddress: `0x${string}` | undefined = "0x1111111111111111111111111111111111111111";
let mockChainId = 43113;

vi.mock("wagmi", async (importOriginal) => {
  const actual = await importOriginal<typeof import("wagmi")>();
  return {
    ...actual,
    useAccount: () => ({
      address: mockAddress,
      isConnected: !!mockAddress,
      chainId: mockChainId,
    }),
    useChainId: () => mockChainId,
    useReadContract: ({ functionName }: any) => {
      if (functionName === "getRoom") {
        return {
          data: {
            playerA: "0x1111111111111111111111111111111111111111",
            playerB: "0x2222222222222222222222222222222222222222",
            stake: BigInt("100000000000000000"), // 0.1 AVAX
            status: 1, // Active
            creatorIsWhite: true,
            gameStarted: false,
            joinedAt: BigInt(Math.floor(Date.now() / 1000)),
          },
        };
      }
      if (functionName === "nextRoomId") return { data: BigInt(100) };
      if (functionName === "pendingWithdrawals") return { data: BigInt("190000000000000000") }; // 0.19 AVAX
      return { data: undefined };
    },
    useWriteContract: () => ({
      writeContractAsync: vi.fn(),
      reset: vi.fn(),
    }),
    useWaitForTransactionReceipt: () => ({
      isLoading: false,
      isSuccess: false,
    }),
    useWatchContractEvent: () => {},
    useSignTypedData: () => ({
      signTypedDataAsync: vi.fn(),
    }),
  };
});

describe("GamePage Online Mode (Turn 3c-2 Item 4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    mockAddress = "0x1111111111111111111111111111111111111111";
    mockChainId = 43113;
  });

  it("renders guide when roomId param is missing from URL", () => {
    render(<GamePage />);
    expect(screen.getByRole("heading", { name: /Chưa chọn phòng thi đấu/i })).toBeDefined();
  });

  it("renders online game controls and abort/refund countdown when room param is provided", () => {
    mockSearchParams.set("room", "42");
    render(<GamePage />);
    expect(screen.getByText(/Phòng #42|Phòng 42/i)).toBeDefined();
    // Check buttons for online actions
    expect(screen.getByRole("button", { name: /đầu hàng/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /xin hòa/i })).toBeDefined();
  });
});
