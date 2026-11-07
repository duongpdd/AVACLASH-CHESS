import { RELAY_URL } from "@/config/env";

export const eloUrl = "/api/tournaments/elo";

export function profileUrl(wallet: string) {
  return `/api/tournaments/profile?${new URLSearchParams({ wallet })}`;
}

export function replayUrl(roomId: number) {
  const url = new URL(RELAY_URL);
  url.protocol = url.protocol === "wss:" ? "https:" : "http:";
  url.pathname = `/tournament/replay/${roomId}`;
  url.search = "";
  return url;
}
