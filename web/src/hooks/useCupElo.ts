import { useQuery } from "@tanstack/react-query";
import { CHAIN_ID, tournamentEnabled } from "@/config/env";
import type { CupRating } from "@/utils/tournament-elo";

export function useCupElo() {
  return useQuery({
    queryKey: ["tournament-elo", CHAIN_ID],
    enabled: tournamentEnabled,
    queryFn: async ({
      signal,
    }): Promise<{ startingElo: number; ratings: CupRating[] }> => {
      const response = await fetch("/api/tournaments/elo", { signal });
      if (!response.ok) throw new Error("Cup ratings unavailable");
      return response.json();
    },
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
