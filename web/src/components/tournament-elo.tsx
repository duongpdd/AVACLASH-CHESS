"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAccount } from "wagmi";
import { tournamentEnabled } from "@/config/env";
import { useCupElo } from "@/views/ranking/hooks/query/use-cup-elo";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { DataWithStatus } from "@/components/status/data-with-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { showApiError } from "@/utils/show-api-error";
import { ChartNoAxesColumnIncreasing } from "lucide-react";

export default function TournamentElo({
  compact = false,
}: {
  compact?: boolean;
}) {
  const t = useTranslations("ranking");
  const status = useTranslations("statusDisplay");
  const { address } = useAccount();
  const [showAll, setShowAll] = useState(false);
  const board = useCupElo();
  useEffect(() => {
    if (board.isError) showApiError(t("failed"));
  }, [board.isError, t]);
  if (!tournamentEnabled) return null;

  const ratings = board.data?.ratings ?? [];
  const player = ratings.find((row) => row.address === address?.toLowerCase());
  const empty = !board.isPending && !board.isError && !ratings.length;
  if (compact && empty) return null;
  const emptyContent = (
    <>
      <Table className="ranking-empty-table">
        <TableHeader>
          <TableRow>
            <TableHead>{t("rank")}</TableHead>
            <TableHead>{t("wallet")}</TableHead>
            <TableHead>{t("elo")}</TableHead>
            <TableHead>{t("record")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody aria-hidden="true">
          {[0, 1, 2].map((row) => (
            <TableRow key={row}>
              {[0, 1, 2, 3].map((column) => (
                <TableCell key={column}>
                  <span className="ranking-placeholder" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Link href="/tournaments" className="button-primary w-fit">
        {t("viewTournaments")}
      </Link>
    </>
  );
  return (
    <section
      className={
        compact
          ? "home-rating-section home-ranking grid content-start gap-3"
          : "contents"
      }
      aria-labelledby="elo-cup-title"
    >
      {compact && (
        <div className="home-panel-heading">
          <h2 id="elo-cup-title">
            <ChartNoAxesColumnIncreasing size={19} aria-hidden />
            {t("board")}
          </h2>
          <Link className="text-link" href="/ranking">
            {t("view")}
          </Link>
        </div>
      )}
      <CardCustom
        as="div"
        className="grid content-start gap-4 ranking-card"
        id="elo-cup"
      >
        {!compact && (
          <div>
            <h2 id="elo-cup-title" className="text-description font-semibold">
              {t("board")}
            </h2>
            <p className="text-description mt-2">
              {empty ? (
                t("emptyIntro")
              ) : (
                <>
                  {board.data && t("start", { elo: board.data.startingElo })}
                  {t("details")}
                </>
              )}
            </p>
          </div>
        )}
        <DataWithStatus
          error={
            board.isError && (
              <div className="flex flex-wrap items-center gap-3">
                <p>{t("failed")}</p>
                <Button
                  disabled={board.isFetching}
                  onClick={() => void board.refetch()}
                >
                  {status("retry")}
                </Button>
              </div>
            )
          }
          loading={board.isPending}
          noData={!ratings.length && emptyContent}
          noDataLayout="custom"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("rank")}</TableHead>
                <TableHead>{t("player")}</TableHead>
                <TableHead>{t("elo")}</TableHead>
                <TableHead>{t("games")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(showAll ? ratings : ratings.slice(0, compact ? 3 : 10)).map(
                (row) => (
                  <TableRow
                    key={row.address}
                    className="border-t border-border"
                  >
                    <TableCell className="py-2">{row.rank}</TableCell>
                    <TableCell className="font-mono" title={row.address}>
                      <Link
                        className="text-link"
                        href={`/profile?wallet=${row.address}`}
                      >
                        {row.address.slice(0, 8)}…{row.address.slice(-4)}
                      </Link>
                      {row.address === player?.address && ` · ${t("you")}`}
                    </TableCell>
                    <TableCell className="font-semibold text-primary">
                      {row.rating}
                    </TableCell>
                    <TableCell>{row.games}</TableCell>
                  </TableRow>
                ),
              )}
            </TableBody>
          </Table>
        </DataWithStatus>
        {!compact && address && board.data && !board.isError && (
          <p className="rounded-card border border-border bg-muted p-3">
            {t("yourElo")} ·{" "}
            <strong>{player?.rating ?? board.data.startingElo}</strong> ·{" "}
            {player
              ? t("ranked", { rank: player.rank, games: player.games })
              : t("unranked")}
          </p>
        )}
        {!compact && !board.isError && ratings.length > 10 && (
          <Button
            className="w-fit"
            onClick={() => setShowAll(!showAll)}
            aria-expanded={showAll}
          >
            {showAll ? t("collapse") : t("showAll", { count: ratings.length })}
          </Button>
        )}
      </CardCustom>
    </section>
  );
}
