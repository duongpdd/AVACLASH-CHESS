import { z } from "zod";
import { eloUrl, profileUrl, replayUrl } from "./api-url";
import type { EloResponse, ProfileResponse } from "./type";

async function getJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

export function getCupElo(signal?: AbortSignal) {
  return getJson<EloResponse>(eloUrl, signal);
}

export function getCupProfile(wallet: string, signal?: AbortSignal) {
  return getJson<ProfileResponse>(profileUrl(wallet), signal);
}

const replaySchema = z.object({
  moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)),
});

export async function getCupReplay(roomId: number, signal?: AbortSignal) {
  const response = await fetch(replayUrl(roomId), { signal });
  if (response.status === 404) return null;
  if (!response.ok)
    throw new Error(`Replay request failed (${response.status})`);
  return replaySchema.parse(await response.json()).moves;
}
