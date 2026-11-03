import { ChessGame } from "@avaclash/shared";
import { Chess } from "chess.js";

type MatchHeaders = {
  roomId: number;
  tournamentId: bigint;
  white: string;
  black: string;
  outcome?: number;
};

export function buildTournamentPgn(
  moves: readonly string[],
  match: MatchHeaders,
): string | null {
  return buildTournamentRecord(moves, match)?.pgn ?? null;
}

export function buildTournamentRecord(
  moves: readonly string[],
  match: MatchHeaders,
): { pgn: string; fen: string } | null {
  const game = new Chess();
  try {
    for (const uci of moves) {
      const move = ChessGame.parseUci(uci);
      if (!move) return null;
      game.move(move);
    }
  } catch {
    return null;
  }

  game.setHeader("Event", `AvaClash Cup #${match.tournamentId}`);
  game.setHeader("Round", "?");
  game.setHeader("White", match.white);
  game.setHeader("Black", match.black);
  game.setHeader("Board", String(match.roomId));
  game.setHeader("TimeControl", "300+0");
  const result = ["1-0", "0-1", "1/2-1/2"][match.outcome ?? -1] ?? "*";
  game.setHeader("Result", result);
  return { pgn: `${game.pgn({ maxWidth: 80 })}\n`, fen: game.fen() };
}
