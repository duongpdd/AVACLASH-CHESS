import type { CupRating } from "@/utils/tournament-elo";

export type EloResponse = { startingElo: number; ratings: CupRating[] };
export type ProfileResponse = {
  rating: number;
  rank: number | null;
  ratedGames: number;
  titles: { id: string; title: string; shared: boolean }[];
  games: {
    id: string;
    title: string;
    room: string;
    opponent: string;
    outcome: string | null;
    status: string;
    movesHash: string | null;
  }[];
};
