// @vitest-environment happy-dom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { computeMovesHash } from "@avaclash/shared";
import TournamentPlayPage from "@/app/tournaments/play/page";

const { send, white, black } = vi.hoisted(() => ({
  send: vi.fn().mockResolvedValue(undefined),
  white: "0x1111111111111111111111111111111111111111",
  black: "0x2222222222222222222222222222222222222222",
}));
const moves = ["f2f3", "e7e5", "g2g4", "d8h4"];
const movesHash = computeMovesHash(moves);

vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("room=7&id=0"),
}));
vi.mock("@/components/AppHeader", () => ({ default: () => null }));
vi.mock("@/components/AppFooter", () => ({ default: () => null }));
vi.mock("@/config/env", () => ({
  CHAIN_ID: 43113,
  NETWORK_NAME: "Avalanche Fuji",
  RELAY_URL: "wss://example.test",
  TOURNAMENT_ADDRESS: "0x3333333333333333333333333333333333333333",
  tournamentEnabled: true,
  ZERO_ADDRESS: "0x0000000000000000000000000000000000000000",
}));
vi.mock("wagmi", () => ({
  useAccount: () => ({ address: white, chainId: 43113 }),
  useReadContract: ({ functionName }: { functionName: string }) => ({
    data:
      functionName === "getRoom"
        ? { playerA: white, playerB: black, creatorIsWhite: true, status: 1 }
        : [0n, 0, false, false],
    refetch: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTournamentTx", () => ({
  tournamentContract: {},
  useTournamentTx: () => ({ send, busy: false, message: "" }),
}));
vi.mock("@/hooks/useRelaySession", () => ({
  useRelaySession: () => ({
    moves,
    whiteMs: 0,
    blackMs: 0,
    gameFinished: true,
    resultProposal: {
      winner: black,
      outcome: 1,
      reason: 0,
      moveCount: moves.length,
      movesHash,
      nonce: "1",
      deadline: "100",
    },
    relaySignature: "0x1234",
  }),
}));

afterEach(cleanup);

it("shows PGN and the UCI commitment before asking the wallet to send a result", async () => {
  render(<TournamentPlayPage />);
  fireEvent.click(screen.getByRole("button", { name: "Xem và gửi biên bản" }));
  const dialog = screen.getByRole("dialog", {
    name: "Xác nhận biên bản ván #7",
  });
  expect(within(dialog).getByText(movesHash)).toBeDefined();
  expect(within(dialog).getByText(/Qh4#/)).toBeDefined();
  expect(within(dialog).getByText("FEN cuối ván")).toBeDefined();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(
    within(dialog).getByRole("button", {
      name: "Ký và gửi lên Avalanche Fuji",
    }),
  );
  await waitFor(() =>
    expect(send).toHaveBeenCalledWith({
      functionName: "reportResult",
      args: [
        {
          matchId: 7n,
          winner: black,
          outcome: 1,
          reason: 0,
          moveCount: 4,
          movesHash,
          nonce: 1n,
          deadline: 100n,
        },
        "0x1234",
      ],
    }),
  );
});
