import { ChessGame } from "@avaclash/shared";
import { Chess } from "chess.js";

export function buildTournamentPgn(
  moves: readonly string[],
  match: {
    roomId: number;
    tournamentId: bigint;
    white: string;
    black: string;
    outcome?: number;
  },
): string | null {
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
  return `${game.pgn({ maxWidth: 80 })}\n`;
}
