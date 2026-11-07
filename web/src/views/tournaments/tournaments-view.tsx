"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";
import Link from "next/link";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAccount } from "wagmi";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Failed } from "@/components/status/data-with-status";
import { FieldError } from "@/components/status/field-error";
import AppHeader from "@/components/app-header";
import AppFooter from "@/components/app-footer";
import TournamentCatalog, {
  useTournamentIndex,
} from "@/components/tournament-catalog";
import TournamentDetails from "@/components/tournament/tournament-details";
import { EmptyState, Skeleton } from "@/components/ui-state";
import {
  CHAIN_ID,
  FUJI_EXPLORER_URL,
  NETWORK_NAME,
  tournamentEnabled,
} from "@/config/env";
import { useTournamentTx } from "@/hooks/use-tournament-tx";
import { parseRoomId } from "@/utils/room";

function TournamentLobby() {
  const uiText = useUiCopy();
  const router = useRouter();
  const params = useSearchParams();
  const { address } = useAccount();
  const tx = useTournamentTx();
  const index = useTournamentIndex();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ id: string }>();
  const block = index.block.data;
  const rawId = params.get("id");
  const urlId = parseRoomId(rawId);
  const invalidId = rawId !== null && urlId === undefined;
  const id = urlId === undefined ? undefined : BigInt(urlId);
  if (!tournamentEnabled)
    return (
      <EmptyState
        title={uiText("messageTournamentsAreUnavailableOnThisNetwork")}
        action={
          <Link href="/practice" className="button-secondary">
            {uiText("messageSolveAPuzzle")}
          </Link>
        }
      />
    );
  return (
    <div className="grid gap-5">
      {id !== undefined && (
        <Link className="text-link w-fit" href="/tournaments">
          {uiText("messageTournamentList2")}
        </Link>
      )}
      <div role="status" className="text-sm text-status-warning">
        {uiText.existing(tx.message)}
        {tx.hash && CHAIN_ID === 43113 && (
          <a
            className="ml-2 underline"
            href={`${FUJI_EXPLORER_URL}/tx/${tx.hash}`}
            target="_blank"
            rel="noreferrer"
          >
            {uiText("messageViewTransaction")}
          </a>
        )}
      </div>
      {id === undefined ? (
        <>
          {invalidId && (
            <CardCustom>
              <Failed>{uiText("messageEnterAValidTournamentCode")}</Failed>
            </CardCustom>
          )}
          <p className="helper-text">
            {uiText("messageShowingUpTo12RecentTournaments")}
          </p>
          <TournamentCatalog index={index} />
          <details className="surface-card" open={invalidId || undefined}>
            <summary className="cursor-pointer font-semibold">
              {uiText("messageFindATournamentByCode")}
            </summary>
            <form
              className="mt-3 flex flex-wrap items-end gap-2"
              noValidate
              onSubmit={handleSubmit(({ id }) =>
                router.push(`/tournaments?id=${parseRoomId(id)}`),
              )}
            >
              <label className="text-label">
                {uiText("messageTournamentCode")}
                <Input
                  inputMode="numeric"
                  placeholder="0"
                  aria-invalid={!!errors.id}
                  {...register("id", {
                    validate: (value) =>
                      parseRoomId(value) !== undefined ||
                      uiText("messageEnterAValidTournamentCode"),
                  })}
                />
                <FieldError message={errors.id?.message} />
              </label>
              <Button type="submit" disabled={isSubmitting}>
                {uiText("messageOpenTournament")}
              </Button>
            </form>
          </details>
          <Link href="/tournaments/new" className="button-secondary w-fit">
            {uiText("messageOrganizeATournament")}
          </Link>
        </>
      ) : block ? (
        <TournamentDetails
          key={`${id}:${address ?? "viewer"}`}
          id={id}
          tx={tx}
          now={block.timestamp}
        />
      ) : (
        <CardCustom as="div">
          <p role="status">
            {index.block.isError
              ? uiText("messageCouldNotReadTournamentDataFrom")
              : uiText("messageReadingTournamentData")}
          </p>
          {index.block.isError && (
            <Button
              type="button"
              className="mt-3"
              onClick={() => void index.block.refetch()}
            >
              {uiText("messageRetry")}
            </Button>
          )}
        </CardCustom>
      )}
    </div>
  );
}

export default function TournamentsPage() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  return (
    <div className="app-shell">
      <AppHeader active="tournament" />
      <main className="site-container play-page">
        <PageHeader
          eyebrow={<>AVACLASH CUP · {NETWORK_NAME}</>}
          title={t("cupPageTitle")}
          description={t("cupPageDescription")}
          actions={
            <>
              <Link href="/practice" className="text-link">
                {t("tryPuzzle")}
              </Link>
            </>
          }
        />
        <Suspense
          fallback={<Skeleton label={uiText("messageLoadingTournaments")} />}
        >
          <TournamentLobby />
        </Suspense>
        <Link id="elo-cup" className="button-secondary mt-5" href="/ranking">
          {t("rankings")}
        </Link>
      </main>
      <AppFooter />
    </div>
  );
}
