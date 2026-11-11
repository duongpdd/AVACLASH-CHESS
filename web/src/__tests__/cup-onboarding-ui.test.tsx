// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/test/render";
import TournamentElo from "@/components/tournament-elo";
import GuidePage from "@/views/guide/guide-view";
import { TestnetBadge } from "@/components/fuji-testnet-banner";

const queryState = vi.hoisted(() => ({ isPending: false, isError: false }));

vi.mock("@/config/env", () => ({
  CHAIN_ID: 31337,
  tournamentEnabled: true,
  CURRENCY_SYMBOL: "ETH",
  RPC_URL: "http://localhost",
  FUJI_FAUCET_URL: "https://example.test",
}));
vi.mock("@/config/wagmi", () => ({ targetChain: { id: 31337 } }));
vi.mock("@/components/app-header", () => ({ default: () => null }));
vi.mock("@/components/app-footer", () => ({ default: () => null }));
vi.mock("wagmi", () => ({
  useAccount: () => ({}),
  useChainId: () => 31337,
  useConnect: () => ({ connectors: [], connect: vi.fn() }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
}));
vi.mock("@/views/ranking/hooks/query/use-cup-elo", () => ({
  useCupElo: () => ({
    data: { ratings: [], startingElo: 1200 },
    ...queryState,
  }),
}));
afterEach(() => {
  cleanup();
  queryState.isPending = false;
  queryState.isError = false;
});
it("does not announce an empty ranking before its query finishes", () => {
  queryState.isPending = true;
  render(<TournamentElo />);
  expect(screen.getByRole("status")).toBeTruthy();
  expect(
    screen.queryByText(/Bảng xếp hạng sẽ xuất hiện sau giải đầu tiên/),
  ).toBeNull();
  expect(screen.queryByRole("columnheader", { name: "Ví" })).toBeNull();
});
it("hides the compact ranking entirely when no tournament has finalized", () => {
  const { container } = render(<TournamentElo compact />);
  expect(container.textContent).toBe("");
});
it("explains empty rankings with column headers and a real tournament action", () => {
  render(<TournamentElo />);
  expect(
    screen.getByText(/Bảng xếp hạng sẽ xuất hiện sau giải đầu tiên/),
  ).toBeTruthy();
  for (const name of ["Hạng", "Ví", "Elo", "Thắng/Hòa/Thua"])
    expect(screen.getByRole("columnheader", { name })).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Xem giải đấu" }).className,
  ).toContain("button-primary");
});
it("labels the player guide and keeps its wallet hint below the action row", () => {
  render(<GuidePage />);
  expect(screen.getByText("Dành cho kỳ thủ")).toBeTruthy();
  const hint = screen.getByText("MetaMask hoặc Core · Nối ví không mất phí");
  expect(hint.previousElementSibling?.className).toContain("items-start");
  expect(
    screen.getByText("Dành cho ban tổ chức").closest("details"),
  ).toBeTruthy();
  expect(
    screen.getByRole("link", { name: "Tổ chức giải" }).getAttribute("href"),
  ).toBe("/tournaments/new");
});
it("identifies the supported local network as testnet next to branding", () => {
  render(<TestnetBadge />);
  expect(screen.getByText("Testnet").className).toBe("testnet-badge");
});
