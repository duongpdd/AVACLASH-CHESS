import { useQuery } from "@tanstack/react-query";
import { CHAIN_ID, RELAY_URL, TOURNAMENT_ADDRESS } from "@/config/env";
import { getCupReplay } from "@/services/tournament-services/api";

export function useCupReplay(roomId: number) {
  return useQuery({
    queryKey: [
      "tournament-replay",
      CHAIN_ID,
      TOURNAMENT_ADDRESS,
      RELAY_URL,
      roomId,
    ],
    queryFn: ({ signal }) => getCupReplay(roomId, signal),
    retry: false,
  });
}
