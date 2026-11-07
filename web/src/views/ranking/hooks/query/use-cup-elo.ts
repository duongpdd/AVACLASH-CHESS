import { useQuery } from "@tanstack/react-query";
import { CHAIN_ID, tournamentEnabled } from "@/config/env";
import { getCupElo } from "@/services/tournament-services/api";

export function useCupElo() {
  return useQuery({
    queryKey: ["tournament-elo", CHAIN_ID],
    enabled: tournamentEnabled,
    queryFn: ({ signal }) => getCupElo(signal),
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });
}
