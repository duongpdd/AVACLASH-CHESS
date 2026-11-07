import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import { buildTournamentPgn } from "@/utils/tournament-pgn";

const match = {
  roomId: 0,
  tournamentId: 2n,
  white: "0x0000000000000000000000000000000000000001",
  black: "0x0000000000000000000000000000000000000002",
};
const moves = ["f2f3", "e7e5", "g2g4", "d8h4"];

describe("tournament PGN export", () => {
  it("round-trips the full transcript and the approved result", () => {
    const pgn = buildTournamentPgn(moves, { ...match, outcome: 1 })!;
    const imported = new Chess();
    imported.loadPgn(pgn);
    expect(imported.history()).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(imported.getHeaders()).toMatchObject({
      Event: "AvaClash Cup #2",
      Board: "0",
      White: match.white,
      Black: match.black,
      Result: "0-1",
    });
  });

  it("leaves an unapproved result open and rejects illegal moves", () => {
    expect(buildTournamentPgn(moves, match)).toMatch(/\[Result "\*"\]/);
    expect(buildTournamentPgn(["e2e5"], match)).toBeNull();
  });
});
