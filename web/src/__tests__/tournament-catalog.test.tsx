// @vitest-environment happy-dom
import { NextIntlClientProvider } from "next-intl";
import messages from "../messages/vi.json";
import { cleanup, render, screen, within } from "@/test/render";
import { afterEach, expect, it, vi } from "vitest";
import TournamentCatalog, {
  FeaturedTournament,
  useTournamentIndex,
} from "@/components/tournament-catalog";

const fixtures = vi.hoisted(() => [
  { title: "Giải đầu tiên", phase: 0, players: 1 },
  { title: "Giải đã đủ chỗ", phase: 0, players: 8 },
  { title: "Giải hết hạn", phase: 0, players: 1, registrationEnds: 99n },
  { title: "Giải đang chơi", phase: 1, players: 8 },
  { title: "Giải đã chốt", phase: 2, players: 8 },
  { title: "Giải chưa có quỹ", phase: 0, players: 0, funded: 0n },
]);

vi.mock("wagmi", () => ({
  useBlock: () => ({ data: { timestamp: 100n } }),
  useReadContract: () => ({ data: BigInt(fixtures.length) }),
  useReadContracts: ({
    contracts,
  }: {
    contracts: { functionName: string; args: [bigint] }[];
  }) => ({
    data: contracts.map(({ functionName, args: [id] }) => {
      const fixture = fixtures[Number(id)];
      return {
        status: "success",
        result:
          functionName === "standings"
            ? [Array(fixture.players).fill("0x1"), []]
            : {
                capacity: 8,
                funded: 1n,
                registrationEnds: 200n,
                completionDeadline: 300n,
                ...fixture,
              },
      };
    }),
  }),
}));

function Catalog() {
  return <TournamentCatalog index={useTournamentIndex()} />;
}

afterEach(cleanup);

it("groups real registration availability and retains tournament zero in its link", () => {
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <Catalog />
    </NextIntlClientProvider>,
  );
  const open = screen
    .getByRole("heading", { name: "Đang mở đăng ký" })
    .closest("section")!;
  expect(within(open).getAllByRole("link")).toHaveLength(1);
  const first = within(open).getByRole("link", { name: /Giải đầu tiên/ });
  expect(first.getAttribute("href")).toBe("/tournaments?id=0");
  expect(within(first).getByText("Còn 7/8 chỗ")).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Đang thi đấu" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Đã kết thúc" })).toBeTruthy();
  expect(screen.getByText(/Đã đóng đăng ký/)).toBeTruthy();
  expect(screen.getByText(/Chờ nạp quỹ/)).toBeTruthy();
});

it("features an open tournament even when newer tournaments are unavailable", () => {
  render(
    <NextIntlClientProvider locale="vi" messages={messages}>
      <FeaturedTournament />
    </NextIntlClientProvider>,
  );
  const links = screen.getAllByRole("link");
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/tournaments?id=0",
  ]);
});
