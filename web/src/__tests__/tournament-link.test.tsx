// @vitest-environment happy-dom
import { cleanup, render, screen } from "@/test/render";
import { afterEach, expect, it, vi } from "vitest";
import TournamentsPage from "@/views/tournaments/tournaments-view";

const route = vi.hoisted(() => ({ query: "" }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(route.query),
}));
vi.mock("wagmi", () => ({ useAccount: () => ({}) }));
vi.mock("@/components/app-header", () => ({ default: () => null }));
vi.mock("@/hooks/use-tournament-tx", () => ({
  useTournamentTx: () => ({ message: "" }),
}));
vi.mock("@/components/tournament-catalog", () => ({
  default: () => null,
  useTournamentIndex: () => ({ block: { data: { timestamp: 1n } } }),
}));
vi.mock("@/components/tournament/tournament-details", () => ({
  default: ({ id }: { id: bigint }) => <p>Demo {id.toString()}</p>,
}));
vi.mock("@/config/env", () => ({
  CHAIN_ID: 31337,
  FUJI_EXPLORER_URL: "",
  NETWORK_NAME: "Anvil",
  tournamentEnabled: true,
}));

afterEach(cleanup);

it("shows an invalid-link message and opens the code field for correction", () => {
  route.query = "id=abc";
  render(<TournamentsPage />);
  expect(screen.getByRole("alert").textContent).toContain(
    "Nhập mã giải hợp lệ.",
  );
  expect(screen.getByLabelText("Mã giải").closest("details")?.open).toBe(true);
});

it("still opens tournament zero from a valid link", () => {
  route.query = "id=0";
  render(<TournamentsPage />);
  expect(screen.getByText("Demo 0")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});
