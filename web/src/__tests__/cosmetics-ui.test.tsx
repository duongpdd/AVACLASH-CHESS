// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { decodeFunctionData } from "viem";
import { COSMETICS_ABI } from "@avaclash/shared";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render";
import CollectionView from "@/components/cosmetics/collection-view";
import { MatchSkins } from "@/components/cosmetics/match-skins";
import messages from "../messages/vi.json";

const mocks = vi.hoisted(() => {
  const account = "0x1000000000000000000000000000000000000000";
  const seller = "0x2000000000000000000000000000000000000000";
  const skins = "0x4000000000000000000000000000000000000000";
  return {
    account,
    seller,
    skins,
    enabled: true,
    address: account as string | undefined,
    number: 1n,
    read: vi.fn(),
    getCode: vi.fn(),
    block: vi.fn(),
    events: vi.fn(),
    estimateGas: vi.fn(),
    waitReceipt: vi.fn(),
    send: vi.fn(),
  };
});

vi.mock("@/config/env", () => ({
  get cosmeticsEnabled() {
    return mocks.enabled;
  },
  tournamentEnabled: true,
  CHAIN_ID: 31337,
  NETWORK_NAME: "Anvil Local",
  COSMETICS_ADDRESS: mocks.skins,
  TOURNAMENT_ADDRESS: mocks.seller,
}));
vi.mock("wagmi", () => {
  const client = {
    getBlockNumber: () => Promise.resolve(mocks.number),
    readContract: mocks.read,
    getCode: mocks.getCode,
    getBlock: mocks.block,
    getContractEvents: mocks.events,
    estimateGas: mocks.estimateGas,
    waitForTransactionReceipt: mocks.waitReceipt,
  };
  return {
    useAccount: () => ({
      address: mocks.address,
      chainId: 31337,
      isConnected: !!mocks.address,
    }),
    usePublicClient: () => client,
    useSendTransaction: () => ({ sendTransactionAsync: mocks.send }),
  };
});
vi.mock("@/components/wallet-action", () => ({
  default: () => <button>Kết nối ví thử nghiệm</button>,
}));
vi.mock("@/components/layout/preferences", () => ({ Preferences: () => null }));
vi.mock("@/components/fuji-testnet-banner", () => ({ default: () => null }));

const theme = {
  light: 0xe8f3ea,
  dark: 0x53776e,
  lastLight: 0xffe48a,
  lastDark: 0xcbb158,
  whiteFill: 0,
  whiteStroke: 0,
  whiteWidth: 0,
  blackFill: 0,
  blackStroke: 0,
  blackWidth: 0,
  shadow: false,
};
const item = {
  name: "Bàn Ngọc",
  kind: 0,
  theme,
  serial: 1,
  tournamentId: 0n,
  firstOwner: mocks.account,
};

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="vi" messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}

function mount(node: React.ReactNode) {
  const cache = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrap = (content: React.ReactNode) => (
    <QueryClientProvider client={cache}>{content}</QueryClientProvider>
  );
  const result = render(wrap(node), { wrapper });
  return () => result.rerender(wrap(node));
}

beforeEach(() => {
  mocks.enabled = true;
  mocks.address = mocks.account;
  mocks.number = 1n;
  mocks.getCode.mockResolvedValue("0x1234");
  mocks.estimateGas.mockResolvedValue(21000n);
  mocks.send.mockResolvedValue("0x1234");
  mocks.waitReceipt.mockResolvedValue({ status: "success" });
  mocks.read.mockImplementation(async ({ functionName }) => {
    switch (functionName) {
      case "balanceOf":
        return 1n;
      case "equippedIds":
        return [0n, 0n];
      case "tokenOfOwnerByIndex":
        return 1n;
      case "getItem":
        return item;
      case "nextTournamentId":
        return 1n;
      case "canClaim":
        return true;
      case "getOfficial":
        return { ...item, name: "Cúp Ngọc" };
      default:
        throw Error(functionName);
    }
  });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Bộ sưu tập", () => {
  it("hides links and avoids RPC reads when cosmetics are disabled", () => {
    mocks.enabled = false;
    mount(<CollectionView />);
    expect(screen.getByText("Chưa bật trên mạng này")).toBeDefined();
    expect(screen.queryByRole("link", { name: "Bộ sưu tập" })).toBeNull();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("shows a wallet action without enumerating tokens for a disconnected visitor", () => {
    mocks.address = undefined;
    mount(<CollectionView />);
    expect(screen.getByText("Kết nối ví để xem bộ sưu tập")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Kết nối ví thử nghiệm" }),
    ).toBeDefined();
    expect(mocks.read).not.toHaveBeenCalled();
  });

  it("shows eligible trophies and sends a claim only after the button is pressed", async () => {
    mount(<CollectionView />);
    expect(await screen.findByText("Cúp Ngọc")).toBeDefined();
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Nhận skin" }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith(
        expect.objectContaining({ to: mocks.skins }),
      ),
    );
    expect(mocks.getCode).toHaveBeenCalledWith({ address: mocks.skins });
    expect(mocks.waitReceipt).toHaveBeenCalled();
  });

  it("keeps the equipment action and omits the marketplace entry points", async () => {
    mount(<CollectionView />);
    const equip = await screen.findByRole("button", { name: "Trang bị" });
    expect(screen.getByRole("link", { name: "Bộ sưu tập" })).toBeDefined();
    expect(screen.queryByRole("link", { name: "Chợ" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Rao đấu giá" })).toBeNull();
    fireEvent.click(equip);
    await waitFor(() => expect(mocks.send).toHaveBeenCalledTimes(1));
    const [{ to, data, value }] = mocks.send.mock.calls[0]!;
    expect(to).toBe(mocks.skins);
    expect(value).toBeUndefined();
    expect(decodeFunctionData({ abi: COSMETICS_ABI, data })).toEqual({
      functionName: "equip",
      args: [1n],
    });
  });
});

it("uses the same start block for late viewers and lets a player hide the opposing board", async () => {
  const start = { tournamentId: 0n, timestamp: 10n };
  mocks.number = 9n;
  mocks.block.mockImplementation(async ({ blockNumber }) => ({
    timestamp: blockNumber * 2n,
  }));
  mocks.events.mockResolvedValue([{ blockNumber: 5n }]);
  const read = mocks.read.getMockImplementation()!;
  mocks.read.mockImplementation(async (args) => {
    if (args.functionName === "equippedIds") {
      return args.blockNumber === 5n && args.args[0] === mocks.account
        ? [1n, 0n]
        : [0n, 0n];
    }
    return read(args);
  });
  const props = {
    white: mocks.account as `0x${string}`,
    black: mocks.seller as `0x${string}`,
  };
  mount(
    <MatchSkins {...props} start={start} viewer="spectator">
      {() => <div />}
    </MatchSkins>,
  );
  expect(await screen.findByText("Bàn · Bàn Ngọc")).toBeDefined();
  expect(mocks.read).toHaveBeenCalledWith(
    expect.objectContaining({ blockNumber: 5n, functionName: "equippedIds" }),
  );
  cleanup();

  mocks.number = 50n;
  mount(
    <MatchSkins {...props} start={start} viewer="b">
      {() => <div />}
    </MatchSkins>,
  );
  expect(await screen.findByText("Bàn · Bàn Ngọc")).toBeDefined();
  fireEvent.click(screen.getByRole("button", { name: "Tắt skin của đối thủ" }));
  expect(screen.getByText("Bàn · Mặc định")).toBeDefined();
  expect(
    screen
      .getByRole("button", { name: "Tắt skin của đối thủ" })
      .getAttribute("aria-pressed"),
  ).toBe("true");
  window.localStorage.removeItem("avaclash:hide-opponent-skin");
  cleanup();

  mount(
    <MatchSkins {...props} viewer="spectator">
      {() => <div />}
    </MatchSkins>,
  );
  expect(await screen.findByText("Bàn · Mặc định")).toBeDefined();
  expect(screen.getByText("Hiển thị theo trang bị hiện tại")).toBeDefined();
});
