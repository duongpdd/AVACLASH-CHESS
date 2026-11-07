// @vitest-environment happy-dom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@/test/render";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CreateTournament from "@/components/tournament/create-tournament";
import type { TournamentTx } from "@/hooks/use-tournament-tx";
import { tournamentRevertMessage } from "@/utils/tournament-errors";
import messages from "@/messages/vi.json";

const organizer = "0x1000000000000000000000000000000000000001";
const relay = "0x2000000000000000000000000000000000000002";
const referee = "0x3000000000000000000000000000000000000003";

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: organizer }),
  useReadContract: () => ({ data: relay }),
}));
vi.mock("@/config/env", () => ({
  CHAIN_ID: 43113,
  TOURNAMENT_ADDRESS: "0x4000000000000000000000000000000000000004",
}));

const send = vi.fn();
const submitted = () =>
  send.mock.calls.filter(([call]) => call?.functionName === "createTournament");

async function submit(reviewer: string) {
  render(
    <CreateTournament
      tx={{ send, busy: false } as unknown as TournamentTx}
      now={1000n}
      onCreated={() => {}}
    />,
  );
  fireEvent.change(screen.getByLabelText(/Tên giải/), {
    target: { value: "Cup" },
  });
  fireEvent.change(screen.getByLabelText(/Ví trọng tài/), {
    target: { value: reviewer },
  });
  fireEvent.change(screen.getByLabelText(/Điều lệ/), {
    target: { value: "Rules" },
  });
  fireEvent.submit(screen.getByRole("button", { name: /Tạo giải/ }));
}

beforeEach(() => send.mockResolvedValue(undefined));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("create tournament referee", () => {
  it("rejects the organizer wallet before sending", async () => {
    await submit(organizer);
    expect(
      await screen.findByText(
        messages.ui.messageRefereeMustDifferFromOrganizer,
      ),
    ).toBeDefined();
    expect(submitted()).toHaveLength(0);
  });

  it("rejects the relay wallet before sending", async () => {
    await submit(relay);
    expect(
      await screen.findByText(messages.ui.messageRefereeCannotBeRelay),
    ).toBeDefined();
    expect(submitted()).toHaveLength(0);
  });

  it("sends a separate referee wallet", async () => {
    await submit(referee);
    await waitFor(() => expect(submitted()).toHaveLength(1));
  });
});

describe("tournament revert messages", () => {
  it("decodes a nested InvalidInput custom error", () => {
    const error = { cause: { cause: { data: "0xb4fa3fb3" } } };
    expect(tournamentRevertMessage(error)).toBe(
      "messageTournamentInvalidInput",
    );
  });

  it("ignores errors without decodable revert data", () => {
    expect(tournamentRevertMessage(new Error("network"))).toBeUndefined();
    expect(tournamentRevertMessage({ data: "0x12345678" })).toBeUndefined();
  });
});
