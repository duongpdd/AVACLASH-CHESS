import { useQuery } from "@tanstack/react-query";
import { CHAIN_ID, tournamentEnabled } from "@/config/env";
import { getCupProfile } from "@/services/tournament-services/api";

export function useCupProfile(wallet?: string) {
  return useQuery({
    queryKey: ["cup-profile", CHAIN_ID, wallet],
    enabled: tournamentEnabled && !!wallet,
    staleTime: 30_000,
    queryFn: ({ signal }) => getCupProfile(wallet!, signal),
  });
}
