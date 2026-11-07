"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { formatCurrency } from "@/utils/format-currency";
import { formatDateTime } from "@/utils/format-date";
import type { StatusTone } from "@/utils/status-badge-colors";
import { useBlock, useReadContract, useReadContracts } from "wagmi";
import { CHAIN_ID, tournamentEnabled } from "@/config/env";
import { tournamentContract } from "@/hooks/use-tournament-tx";
import Icon from "./app-icon";
import { DataWithStatus } from "@/components/status/data-with-status";
import { CardCustom } from "@/components/ui/card-custom";
import { StatusPill } from "./ui-state";

const polling = { refetchInterval: 6000 } as const;
const groups = ["open", "waiting", "running", "review", "closed"] as const;
type Group = (typeof groups)[number];
type StatusLabel =
  | Group
  | "cancelled"
  | "finalized"
  | "registrationClosed"
  | "waitingFunding"
  | "full"
  | "seatsUnknown";

type TournamentCardData = {
  title: string;
  phase: number;
  capacity: number;
  registrationEnds: bigint;
  completionDeadline: bigint;
  funded: bigint;
};

function tournamentStatus(
  t: TournamentCardData,
  now: bigint,
  seats?: number,
): { group: Group; label: StatusLabel; tone: StatusTone } {
  if (t.phase === 3)
    return { group: "closed", label: "cancelled", tone: "danger" } as const;
  if (t.phase === 2)
    return {
      group: "closed",
      label: "finalized",
      tone: "success",
    } as const;
  if (t.phase === 1)
    return now < t.completionDeadline
      ? ({ group: "running", label: "running", tone: "progress" } as const)
      : ({ group: "review", label: "review", tone: "warning" } as const);
  if (now >= t.registrationEnds)
    return {
      group: "waiting",
      label: "registrationClosed",
      tone: "deactivated",
    } as const;
  if (t.funded === 0n)
    return {
      group: "waiting",
      label: "waitingFunding",
      tone: "warning",
    } as const;
  if (seats === 0)
    return { group: "waiting", label: "full", tone: "info" } as const;
  if (seats === undefined)
    return {
      group: "waiting",
      label: "seatsUnknown",
      tone: "neutral",
    } as const;
  return { group: "open", label: "open", tone: "success" } as const;
}

export function useTournamentIndex() {
  const count = useReadContract({
    ...tournamentContract,
    functionName: "nextTournamentId",
    query: { enabled: tournamentEnabled, ...polling },
  });
  const block = useBlock({
    chainId: CHAIN_ID,
    query: { enabled: tournamentEnabled, ...polling },
  });
  return { count, block };
}

export default function TournamentCatalog({
  index: { count, block },
  featured = false,
}: {
  index: ReturnType<typeof useTournamentIndex>;
  featured?: boolean;
}) {
  const locale = useLocale();
  const copy = useTranslations("catalog");
  const statusCopy = useTranslations("statusDisplay");
  const next = count.data ?? 0n;
  const ids = Array.from(
    { length: Number(next < 12n ? next : 12n) },
    (_, i) => next - 1n - BigInt(i),
  );
  const tournaments = useReadContracts({
    contracts: ids.map((id) => ({
      ...tournamentContract,
      functionName: "getTournament" as const,
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0, ...polling },
  });
  const standings = useReadContracts({
    contracts: ids.map((id) => ({
      ...tournamentContract,
      functionName: "standings" as const,
      args: [id] as const,
    })),
    query: { enabled: ids.length > 0, ...polling },
  });
  const now = block.data?.timestamp;
  const cards = ids.flatMap((id, i) => {
    const tournament = tournaments.data?.[i];
    if (tournament?.status !== "success" || now === undefined) return [];
    const standing = standings.data?.[i];
    const t = tournament.result;
    const seats =
      standing?.status === "success"
        ? Math.max(0, t.capacity - standing.result[0].length)
        : undefined;
    return [{ id, t, seats, status: tournamentStatus(t, now, seats) }];
  });
  const pending =
    count.isPending ||
    block.isPending ||
    (ids.length > 0 && (tournaments.isPending || standings.isPending));
  const failed =
    count.isError || block.isError || tournaments.isError || standings.isError;
  const incomplete =
    failed ||
    (!pending &&
      (cards.length < ids.length ||
        cards.some(({ seats }) => seats === undefined)));
  const sections = featured ? (["open"] as const) : groups;

  function retry() {
    void count.refetch();
    void block.refetch();
    if (ids.length > 0) {
      void tournaments.refetch();
      void standings.refetch();
    }
  }

  const hasOpen = cards.some(({ status }) => status.group === "open");
  const empty = featured ? !hasOpen : cards.length === 0;
  const failure = incomplete && (
    <div className="grid justify-items-start gap-2">
      <p>{copy("incomplete")}</p>
      <Button onClick={retry}>{statusCopy("retry")}</Button>
    </div>
  );
  if (pending || empty) {
    return (
      <CardCustom>
        <DataWithStatus
          error={failure}
          loading={pending}
          noData={
            <>
              {copy(featured ? "emptyOpen" : "empty")}{" "}
              <Link className="text-link" href="/practice">
                {copy("practice")}
              </Link>
            </>
          }
        >
          {null}
        </DataWithStatus>
      </CardCustom>
    );
  }
  return (
    <div className="grid gap-4">
      {failure && (
        <CardCustom>
          <DataWithStatus error={failure}>{null}</DataWithStatus>
        </CardCustom>
      )}
      {sections.map((group) => {
        const entries = cards.filter(({ status }) => status.group === group);
        if (!entries.length) return null;
        return (
          <section key={group} className="grid gap-3">
            {!featured && (
              <h2 className="text-description font-semibold">{copy(group)}</h2>
            )}
            <ul
              className={
                featured ? "grid" : "grid gap-3 md:grid-cols-2 lg:grid-cols-3"
              }
            >
              {(featured ? entries.slice(0, 1) : entries).map(
                ({ id, t, seats, status }) => (
                  <li key={id.toString()} className="min-w-0">
                    <Link
                      href={`/tournaments?id=${id}`}
                      className="surface-card flex h-full min-w-0 flex-col gap-3 hover:border-status-warning/60!"
                    >
                      <StatusPill tone={status.tone}>
                        {copy("badge", {
                          id: id.toString(),
                          status: copy(status.label),
                        })}
                      </StatusPill>
                      <h3 className="text-lg font-semibold [overflow-wrap:anywhere]">
                        {t.title}
                      </h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-foreground">
                        <span>
                          {copy("funded", { amount: formatCurrency(t.funded) })}
                        </span>
                        <span>
                          {seats === undefined
                            ? copy("capacity", { capacity: t.capacity })
                            : group === "open"
                              ? copy("remaining", {
                                  seats,
                                  capacity: t.capacity,
                                })
                              : copy("participants", {
                                  count: t.capacity - seats,
                                  capacity: t.capacity,
                                })}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">
                        {copy("deadline", {
                          date: formatDateTime(t.registrationEnds, locale),
                        })}
                      </p>
                      <span className="mt-auto flex items-center gap-2 font-semibold text-status-warning">
                        {group === "closed" && t.phase === 2
                          ? copy("results")
                          : copy("view")}
                        <Icon name="arrow" className="h-4 w-4" />
                      </span>
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

export function FeaturedTournament() {
  const index = useTournamentIndex();
  return <TournamentCatalog index={index} featured />;
}
