import { defaultUiText } from "@/i18n/ui-copy";
import { isAddress, zeroHash } from "viem";
import { tournamentEnabled } from "@/config/env";
import { cupReadCache, readCupRecords } from "@/utils/cup-records";
import { calculateCupRatings, CUP_STARTING_ELO } from "@/utils/tournament-elo";

export async function GET(request: Request) {
  const wallet = new URL(request.url).searchParams.get("wallet")?.toLowerCase();
  if (!wallet || !isAddress(wallet)) {
    return Response.json({ error: "Invalid wallet" }, { status: 400 });
  }
  if (!tournamentEnabled) {
    return Response.json({ error: "Cup is unavailable" }, { status: 503 });
  }
  try {
    const cups = await readCupRecords(true);
    const rating = calculateCupRatings(
      cups.filter((cup) => cup.phase === 2),
    ).find((row) => row.address === wallet);
    const titles: { id: string; title: string; shared: boolean }[] = [];
    const games = cups
      .slice()
      .reverse()
      .flatMap((cup) => {
        const points = new Map<string, number>();
        const games = cup.matches.flatMap(
          ({ roomId, white, black, result }) => {
            const a = white.toLowerCase();
            const b = black.toLowerCase();
            if (result.approved) {
              points.set(a, (points.get(a) ?? 0) + [2, 0, 1][result.outcome]);
              points.set(b, (points.get(b) ?? 0) + [0, 2, 1][result.outcome]);
            }
            if (wallet !== a && wallet !== b) return [];
            return [
              {
                id: cup.id.toString(),
                title: cup.title,
                room: roomId.toString(),
                opponent: wallet === a ? black : white,
                outcome: result.approved
                  ? result.outcome === 2
                    ? defaultUiText("messageDraw2")
                    : (result.outcome === 0 ? a : b) === wallet
                      ? defaultUiText("messageWin")
                      : defaultUiText("messageLoss")
                  : null,
                status: result.approved
                  ? cup.phase === 2
                    ? defaultUiText("messageFinal")
                    : defaultUiText("messageApproved")
                  : result.reported
                    ? defaultUiText("messageAwaitingReview")
                    : defaultUiText("messageNoResultYet"),
                movesHash:
                  result.movesHash === zeroHash ? null : result.movesHash,
              },
            ];
          },
        );
        const scores = [...points.values()];
        const best = Math.max(...scores);
        if (cup.phase === 2 && points.get(wallet) === best) {
          titles.push({
            id: cup.id.toString(),
            title: cup.title,
            shared: scores.filter((score) => score === best).length > 1,
          });
        }
        return games;
      });
    return Response.json(
      {
        rating: rating?.rating ?? CUP_STARTING_ELO,
        rank: rating?.rank ?? null,
        ratedGames: rating?.games ?? 0,
        titles,
        games,
      },
      { headers: cupReadCache },
    );
  } catch {
    return Response.json({ error: "Cup profile unavailable" }, { status: 503 });
  }
}
