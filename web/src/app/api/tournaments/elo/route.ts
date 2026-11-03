import { connection } from "next/server";
import { tournamentEnabled } from "@/config/env";
import { cupReadCache, readCupRecords } from "@/utils/cup-records";
import { calculateCupRatings, CUP_STARTING_ELO } from "@/utils/tournament-elo";

export async function GET() {
  await connection();
  if (!tournamentEnabled) {
    return Response.json({ error: "Cup is unavailable" }, { status: 503 });
  }
  try {
    const cups = await readCupRecords();
    return Response.json(
      { startingElo: CUP_STARTING_ELO, ratings: calculateCupRatings(cups) },
      { headers: cupReadCache },
    );
  } catch {
    return Response.json({ error: "Cup ratings unavailable" }, { status: 503 });
  }
}
