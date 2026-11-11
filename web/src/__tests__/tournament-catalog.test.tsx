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
                funded: 250_000_000_000_000_000n,
                registrationEnds: 200n,
                completionDeadline: 300n,
                ...fixture,
              },
      };
    }),
  }),
}));

function Catalog({ intent }: { intent?: "sponsor" }) {
  return <TournamentCatalog index={useTournamentIndex()} intent={intent} />;
}

afterEach(cleanup);

it("offers only pre-start tournaments still accepting sponsorship and preserves the sponsor intent", () => {
  render(<Catalog intent="sponsor" />);
  const destinations = screen
    .getAllByRole("link")
    .map((link) => link.getAttribute("href"));
  expect(destinations).toEqual(
    expect.arrayContaining([
      "/tournaments?id=0&intent=sponsor",
      "/tournaments?id=1&intent=sponsor",
      "/tournaments?id=5&intent=sponsor",
    ]),
  );
  expect(destinations).toHaveLength(3);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByText("Giải đang chơi")).toBeNull();
  expect(screen.queryByText("Giải hết hạn")).toBeNull();
});

it("separates status, id and localized facts and omits registration deadlines after play starts", () => {
  render(<Catalog />);
  const open = screen.getByRole("link", { name: /Giải đầu tiên/ });
  expect(within(open).getByText("Đang mở đăng ký").textContent).not.toContain(
    "#",
  );
  expect(within(open).getByText("#0")).toBeTruthy();
  expect(within(open).getByText(/^0,25 (ETH|AVAX) test$/)).toBeTruthy();
  expect(within(open).getByText("Còn dưới 1 giờ")).toBeTruthy();
  const full = screen.getByRole("link", { name: /Giải đã đủ chỗ/ });
  expect(within(full).getByText("Còn 0/8 chỗ")).toBeTruthy();
  for (const name of ["Giải đang chơi", "Giải đã chốt"]) {
    const card = screen.getByRole("link", { name: new RegExp(name) });
    expect(within(card).queryByText("Hạn đăng ký")).toBeNull();
  }
});

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
