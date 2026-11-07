"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useCupProfile } from "./hooks/query/use-cup-profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/status/field-error";
import { showApiError } from "@/utils/show-api-error";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import WalletAction from "@/components/wallet-action";
import { EmptyState, Skeleton } from "@/components/ui-state";
import { tournamentEnabled } from "@/config/env";

function PlayerProfile() {
  const uiText = useUiCopy();
  const params = useSearchParams();
  const router = useRouter();
  const { address } = useAccount();
  const [copyStatus, setCopyStatus] = useState<{
    wallet: string;
    message: string;
  }>();
  const selected = (params.get("wallet") ?? address)?.toLowerCase();
  const wallet = selected && isAddress(selected) ? selected : undefined;
  const profile = useCupProfile(wallet);
  useEffect(() => {
    if (profile.isError)
      showApiError(uiText("messageCouldNotLoadThePlayerProfile"));
  }, [profile.isError, uiText]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ wallet: string }>();
  const data = profile.data;
  return (
    <div className="grid gap-4">
      {!tournamentEnabled ? (
        <EmptyState title={uiText("messageAvaclashCupIsUnavailableOnThis")} />
      ) : !wallet ? (
        <EmptyState
          title={
            address
              ? uiText("messageInvalidWalletAddress")
              : uiText("messageConnectYourWalletToViewYour")
          }
          action={
            address ? (
              <Link href="/profile" className="button-secondary">
                {uiText("messageBackToMyProfile")}
              </Link>
            ) : (
              <WalletAction />
            )
          }
        />
      ) : profile.isPending ? (
        <Skeleton label={uiText("messageLoadingTheTournamentProfile")} />
      ) : null}
      {profile.isError && (
        <EmptyState
          title={uiText("messageCouldNotLoadTheProfile")}
          action={
            <Button type="button" onClick={() => void profile.refetch()}>
              {uiText("messageRetry")}
            </Button>
          }
        />
      )}
      {data && (
        <>
          <CardCustom className="grid gap-3">
            <h2 className="text-description font-semibold">
              {wallet === address?.toLowerCase()
                ? uiText("messageMyResults")
                : uiText("messagePlayerResults")}
            </h2>
            {wallet && (
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <code className="min-w-0 break-all text-sm text-foreground">
                  {wallet}
                </code>
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(wallet);
                      setCopyStatus({
                        wallet,
                        message: uiText("messageAddressCopied"),
                      });
                    } catch {
                      setCopyStatus({
                        wallet,
                        message: uiText("messageCouldNotCopyYouCanSelect"),
                      });
                    }
                  }}
                >
                  {uiText("messageCopyAddress")}
                </Button>
                {copyStatus?.wallet === wallet && (
                  <p className="helper-text w-full" role="status">
                    {uiText.existing(copyStatus.message)}
                  </p>
                )}
              </div>
            )}
            <dl className="profile-stats grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <dt>Elo Cup</dt>
                <dd className="text-2xl font-bold text-status-warning">
                  {data.rating}
                </dd>
              </div>
              <div>
                <dt>{uiText("messageRank")}</dt>
                <dd className="text-xl font-semibold">
                  {data.rank ?? uiText("messageUnranked")}
                </dd>
              </div>
              <div>
                <dt>{uiText("messageRatedGames")}</dt>
                <dd className="text-2xl font-bold">{data.ratedGames}</dd>
              </div>
              <div>
                <dt>{uiText("messageChampionships")}</dt>
                <dd className="text-2xl font-bold">{data.titles.length}</dd>
              </div>
            </dl>
            {data.titles.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {data.titles.map((title) => (
                  <li key={title.id}>
                    <Link
                      className="button-secondary"
                      href={`/tournaments?id=${title.id}`}
                    >
                      {title.shared
                        ? uiText("messageJointChampion")
                        : uiText("messageChampion")}{" "}
                      · {title.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardCustom>
          <CardCustom className="grid gap-3">
            <h2 className="text-description font-semibold">
              {uiText("messageMatchHistory")}
            </h2>
            {data.games.length === 0 ? (
              <p className="text-muted-foreground">
                {uiText("messageThisWalletHasNoCupMatches")}{" "}
                <Link href="/tournaments" className="text-link">
                  {uiText("messageViewTournaments")}
                </Link>
              </p>
            ) : (
              <ul className="grid gap-2">
                {data.games.map((game) => (
                  <li
                    key={game.room}
                    className="grid gap-1 rounded-lg border border-foreground/10 p-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <p>
                        {game.title} {uiText("messageMatch")}
                        {game.room}
                      </p>
                      <Link
                        className="text-link"
                        href={`/tournaments/play?id=${game.id}&room=${game.room}`}
                      >
                        {game.movesHash
                          ? uiText("messageOpenGameRecord")
                          : uiText("messageOpenMatch")}
                      </Link>
                    </div>
                    <p className="text-sm text-foreground">
                      {uiText("messageOpponent")}{" "}
                      <Link
                        className="text-link font-mono"
                        href={`/profile?wallet=${game.opponent}`}
                      >
                        {game.opponent.slice(0, 8)}…{game.opponent.slice(-4)}
                      </Link>{" "}
                      ·{" "}
                      {game.outcome
                        ? `${uiText.existing(game.outcome)} · `
                        : ""}
                      {uiText.existing(game.status)}
                    </p>
                    {game.movesHash && (
                      <details>
                        <summary className="cursor-pointer py-2 text-sm">
                          {uiText("messageDetails")}
                        </summary>
                        <p className="break-all font-mono text-xs text-foreground">
                          {uiText("messageMoveHash")} {game.movesHash}
                        </p>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardCustom>
        </>
      )}
      <details className="surface-card">
        <summary className="cursor-pointer font-semibold">
          {uiText("messageViewAnotherPlayerSProfile")}
        </summary>
        <form
          className="mt-3 flex flex-wrap items-end gap-3"
          noValidate
          onSubmit={handleSubmit(({ wallet }) =>
            router.push(`/profile?wallet=${wallet}`),
          )}
          key={wallet ?? "guest"}
        >
          <label className="min-w-0 grow">
            {uiText("messagePlayerWalletAddress")}
            <Input
              className="mt-1 block font-mono"
              placeholder="0x…"
              aria-invalid={!!errors.wallet}
              {...register("wallet", {
                setValueAs: (value: string) => value.trim().toLowerCase(),
                validate: (value) =>
                  isAddress(value) ||
                  uiText("messageEnterAValidEvmWalletAddress"),
              })}
            />
            <FieldError message={errors.wallet?.message} />
          </label>
          <Button type="submit" tone="primary" disabled={isSubmitting}>
            {uiText("messageViewProfile")}
          </Button>
        </form>
      </details>
    </div>
  );
}

export default function ProfilePage() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  return (
    <div className="app-shell">
      <div className="site-container play-page">
        <PageHeader
          eyebrow={<>AVACLASH CUP</>}
          title={t("profileTitle")}
          description={t("profileDescription")}
          actions={
            <>
              <Link className="text-link" href="/ranking">
                {uiText("messageEloRankings")}
              </Link>
            </>
          }
        />
        <Suspense
          fallback={<Skeleton label={uiText("messageOpeningProfile")} />}
        >
          <PlayerProfile />
        </Suspense>
      </div>
    </div>
  );
}
