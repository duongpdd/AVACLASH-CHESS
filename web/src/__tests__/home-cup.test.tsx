// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@/test/render";
import HomePage from "@/views/home/home-view";

const state = vi.hoisted(() => ({ enabled: false }));
vi.mock("@/config/env", () => ({
  get tournamentEnabled() {
    return state.enabled;
  },
  NETWORK_NAME: "Anvil Local",
  CHAIN_ID: 31337,
}));
vi.mock("@/config/cosmetics", () => ({ isCosmeticsEnabled: () => false }));
vi.mock("wagmi", () => ({ useAccount: () => ({ isConnected: false }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("@/components/tournament-catalog", () => ({
  FeaturedTournament: () => <p>Featured cup data</p>,
}));
vi.mock("@/components/tournament-elo", () => ({
  default: () => <p>Cup Elo data</p>,
}));

beforeEach(() => {
  state.enabled = false;
});
afterEach(cleanup);

it("keeps the Cup identity and explains missing setup instead of showing the old staking lobby", () => {
  render(<HomePage />);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
    "Vào giải cờ 5 phút.",
  );
  expect(
    screen.getByText("Giải đấu chưa được cấu hình trên mạng này"),
  ).toBeTruthy();
  expect(screen.queryByText("Tiền cược mỗi người")).toBeNull();
  expect(screen.queryByRole("link", { name: "Vault" })).toBeNull();
  expect(
    screen.getByRole("link", { name: "Xếp hạng" }).getAttribute("href"),
  ).toBe("/ranking");
});

it("offers wallet-free play immediately after the hero", () => {
  render(<HomePage />);
  const guest = screen.getByRole("link", { name: "Chơi thử không cần ví" });
  expect(guest.getAttribute("href")).toBe("/practice");
  expect(
    screen
      .getByRole("link", { name: "Chơi 2 người trên 1 máy" })
      .getAttribute("href"),
  ).toBe("/hotseat");
  expect(
    guest
      .closest("aside")
      ?.previousElementSibling?.getAttribute("aria-labelledby"),
  ).toBe("home-title");
  expect(guest.closest("aside")?.nextElementSibling?.id).toBe(
    "open-tournaments",
  );
});

it("routes organizers through the existing protected creation flow", () => {
  render(<HomePage />);
  expect(
    screen.getByRole("link", { name: "Tạo giải" }).getAttribute("href"),
  ).toBe("/tournaments/new");
  expect(
    screen.getByRole("link", { name: "Tìm giải để chơi" }).getAttribute("href"),
  ).toBe("#open-tournaments");
  expect(
    screen.getByRole("link", { name: /Tài trợ một giải/ }).getAttribute("href"),
  ).toBe("/tournaments?intent=sponsor");
});

it("shows tournament discovery and ratings when the Cup contract is configured", () => {
  state.enabled = true;
  render(<HomePage />);
  expect(screen.getByText("Featured cup data")).toBeTruthy();
  expect(screen.getByText("Cup Elo data")).toBeTruthy();
  const tournament = screen.getByText("Featured cup data");
  const organizing = screen.getByRole("heading", {
    name: "Tổ chức một giải. Tiếp sức cộng đồng.",
  });
  const process = screen.getByRole("heading", {
    name: "Một quy trình, từng bước rõ ràng.",
  });
  expect(
    tournament.compareDocumentPosition(organizing) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    process.compareDocumentPosition(screen.getByText("Cup Elo data")) &
      Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
  expect(
    screen.queryByText("Giải đấu chưa được cấu hình trên mạng này"),
  ).toBeNull();
});
