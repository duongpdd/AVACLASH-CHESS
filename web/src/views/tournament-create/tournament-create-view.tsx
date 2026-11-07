"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { useRouter } from "next/navigation";
import CreateTournament from "@/components/tournament/create-tournament";
import { useTournamentIndex } from "@/components/tournament-catalog";
import { EmptyState, Skeleton } from "@/components/ui-state";
import { useTournamentTx } from "@/hooks/use-tournament-tx";
import { CHAIN_ID, FUJI_EXPLORER_URL, tournamentEnabled } from "@/config/env";

export default function NewTournamentPage() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  const router = useRouter();
  const { count, block } = useTournamentIndex();
  const tx = useTournamentTx();
  return (
    <div className="app-shell">
      <div className="site-container play-page space-y-4">
        <PageHeader
          eyebrow={<>AVACLASH CUP</>}
          title={t("organizeTitle")}
          description={t("organizeDescription")}
          actions={
            <>
              <Link className="button-secondary" href="/tournaments">
                {uiText("messageTournamentList")}
              </Link>
            </>
          }
        />
        {!tournamentEnabled ? (
          <EmptyState
            title={uiText("messageTournamentsAreUnavailableOnThisNetwork")}
          />
        ) : block.data ? (
          <CreateTournament
            tx={tx}
            now={block.data.timestamp}
            onCreated={(id) => {
              void count.refetch();
              router.push(`/tournaments?id=${id}`);
            }}
          />
        ) : block.isError ? (
          <EmptyState
            title={uiText("messageCouldNotReadTheNetworkTime")}
            action={
              <Button type="button" onClick={() => void block.refetch()}>
                {uiText("messageRetry")}
              </Button>
            }
          />
        ) : (
          <Skeleton label={uiText("messagePreparingTheForm")} />
        )}
        {tx.message && (
          <p role="status" className="text-sm text-status-warning">
            {uiText.existing(tx.message)}{" "}
            {tx.hash && CHAIN_ID === 43113 && (
              <a
                className="underline"
                href={`${FUJI_EXPLORER_URL}/tx/${tx.hash}`}
                target="_blank"
                rel="noreferrer"
              >
                {uiText("messageViewTransaction")}
              </a>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
