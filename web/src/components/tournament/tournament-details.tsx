"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import Link from "next/link";
import { useState } from "react";
import { useLocale } from "next-intl";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CardCustom } from "@/components/ui/card-custom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DataWithStatus } from "@/components/status/data-with-status";
import { FieldError } from "@/components/status/field-error";
import { statusBadgeClass } from "@/utils/status-badge-colors";
import { formatDateTime } from "@/utils/format-date";
import { formatCurrency } from "@/utils/format-currency";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useBalance, useReadContract } from "wagmi";
import { parseEther } from "viem";
import MatchActions from "@/components/tournament-match-actions";
import TournamentHistory from "@/components/tournament-history";
import ConfirmDialog from "@/components/confirm-dialog";
import Tabs from "@/components/section-tabs";
import { EmptyState, Skeleton } from "@/components/ui-state";
import {
  CHAIN_ID,
  CURRENCY_SYMBOL,
  FUJI_FAUCET_URL,
  ZERO_ADDRESS,
} from "@/config/env";
import {
  tournamentContract,
  type TournamentTx,
} from "@/hooks/use-tournament-tx";
import { useCupElo } from "@/views/ranking/hooks/query/use-cup-elo";

const tabs = [
  { id: "tong-quan", label: "messageOverview" },
  { id: "bang-diem", label: "messageStandings" },
  { id: "lich-van", label: "messageSchedule" },
  { id: "lich-su", label: "messageHistory" },
] as const;
type TournamentTab = (typeof tabs)[number]["id"];

const phaseNames = [
  "messageRegistration",
  "messagePlayAndReview",
  "messagePrizesFinalized",
  "messageCanceled",
] as const;
const outcomes = [
  "messageWhiteWins",
  "messageBlackWins",
  "messageDraw2",
] as const;
const amount = (value: bigint) => formatCurrency(value, " test");
const same = (a: string | undefined, b: string) =>
  a?.toLowerCase() === b.toLowerCase();
const short = (address: string) =>
  `${address.slice(0, 8)}…${address.slice(-4)}`;
const polling = { refetchInterval: 6000 } as const;

export default function TournamentDetails({
  id,
  tx,
  now,
}: {
  id: bigint;
  tx: TournamentTx;
  now: bigint;
}) {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const queryClient = useQueryClient();
  const { data: elo } = useCupElo();
  const router = useRouter();
  const params = useSearchParams();
  const activeTab =
    tabs.find(({ id }) => id === params.get("tab"))?.id ?? "tong-quan";
  const [confirmation, setConfirmation] = useState<
    "requestCancellation" | "approveCancellation"
  >();
  function changeTab(tab: TournamentTab) {
    const query = new URLSearchParams(params.toString());
    query.set("tab", tab);
    router.replace("/tournaments?" + query, { scroll: false });
  }
  const [selectedMatch, selectMatch] = useState<bigint>();
  const [myMatchesOnly, setMyMatchesOnly] = useState(true);
  const [shareStatus, setShareStatus] = useState<"copied" | "manual">();
  const locale = useLocale();
  const date = (seconds: bigint) => formatDateTime(seconds, locale);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<{ fund: string }>();

  const tournament = useReadContract({
    ...tournamentContract,
    functionName: "getTournament",
    args: [id],
    query: polling,
  });
  const standing = useReadContract({
    ...tournamentContract,
    functionName: "standings",
    args: [id],
    query: polling,
  });
  const matches = useReadContract({
    ...tournamentContract,
    functionName: "getMatchViews",
    args: [id],
    query: polling,
  });
  const allocation = useReadContract({
    ...tournamentContract,
    functionName: "getAllocation",
    args: [id],
    query: { ...polling, enabled: tournament.data?.phase === 2 },
  });
  const contributions = useReadContract({
    ...tournamentContract,
    functionName: "contributions",
    args: [id, address ?? ZERO_ADDRESS],
    query: { enabled: !!address, ...polling },
  });
  const refunded = useReadContract({
    ...tournamentContract,
    functionName: "refunded",
    args: [id, address ?? ZERO_ADDRESS],
    query: { enabled: !!address, ...polling },
  });
  const relaySigner = useReadContract({
    ...tournamentContract,
    functionName: "relaySigner",
    query: { enabled: !!address, staleTime: Infinity },
  });
  const balance = useBalance({
    address,
    chainId: CHAIN_ID,
    query: { enabled: !!address && tournament.data?.phase === 0, ...polling },
  });
  function refresh() {
    void Promise.all([
      tournament.refetch(),
      standing.refetch(),
      matches.refetch(),
      allocation.refetch(),
      contributions.refetch(),
      refunded.refetch(),
      queryClient.invalidateQueries({
        queryKey: [
          "tournament-history",
          CHAIN_ID,
          tournamentContract.address,
          id.toString(),
        ],
      }),
    ]);
  }
  const t = tournament.data;
  if (!t) {
    return tournament.isError ? (
      <EmptyState
        title={uiText("messageTournamentNotFoundOrTheNetwork")}
        action={
          <Button onClick={() => void tournament.refetch()}>
            {uiText("messageRetry")}
          </Button>
        }
      />
    ) : (
      <Skeleton label={uiText("messageLoadingTournaments")} />
    );
  }
  const [players, points] = standing.data ?? [[], []];
  const list = matches.data ?? [];
  const ratings = new Map(
    elo?.ratings.map(({ address, rating }) => [address.toLowerCase(), rating]),
  );
  const pairKey = (a: string, b: string) =>
    [a.toLowerCase(), b.toLowerCase()].sort().join(":");
  const pairs = new Map(
    list.map((match) => [pairKey(match.white, match.black), match]),
  );
  const me = players.findIndex((p) => same(address, p));
  const organizer = same(address, t.organizer);
  const reviewer = same(address, t.reviewer);
  const relay = !!relaySigner.data && same(address, relaySigner.data);
  const myMatches = list.filter(
    (match) => same(address, match.white) || same(address, match.black),
  );
  const visibleMatches = me >= 0 && myMatchesOnly ? myMatches : list;
  const myNextMatch = myMatches.find((match) => !match.result.reported);
  const waitingReviews = list.filter(
    (match) => match.result.reported && !match.result.approved,
  ).length;
  const open = t.phase === 0 && now < t.registrationEnds;
  const needsTestFunds = CHAIN_ID === 43113 && balance.data?.value === 0n;
  let registrationBlock = "";
  if (!address)
    registrationBlock = uiText("messageConnectAPlayerWalletToRegister");
  else if (organizer || reviewer || relay || contributions.data) {
    const role = organizer
      ? uiText("messageOrganizer")
      : reviewer
        ? uiText("messageReferee")
        : relay
          ? "relay"
          : uiText("messageSponsor");
    registrationBlock = uiText("messageTheWalletCannotEnterThisTournament", {
      p0: String(role),
    });
  } else if (t.funded === 0n)
    registrationBlock = uiText("messageThisTournamentHasNoPrizeFund");
  else if (players.length >= t.capacity)
    registrationBlock = uiText("messageTheTournamentIsFull");
  else if (balance.data?.value === 0n)
    registrationBlock = uiText("messageYourWalletNeedsTestToPay", {
      p0: String(CURRENCY_SYMBOL),
    });
  else if (
    !relaySigner.data ||
    contributions.data === undefined ||
    !standing.data
  )
    registrationBlock =
      relaySigner.isError || contributions.isError || standing.isError
        ? uiText("messageCouldNotCheckRegistrationEligibilityReload")
        : uiText("messageCheckingRegistrationEligibility");
  const running = t.phase === 1 && now < t.completionDeadline;
  const approvedCount = list.filter((m) => m.result.approved).length;
  const ready =
    t.phase === 1 &&
    list.length > 0 &&
    approvedCount === list.length &&
    t.openAppeals === 0n &&
    t.reviewUntil > 0n &&
    now >= t.reviewUntil;
  const canRefund =
    (t.phase === 3 ||
      (t.phase === 2 && now >= t.claimUntil && t.funded > t.paid)) &&
    !!contributions.data &&
    !refunded.data;
  const prize = me < 0 ? 0n : (allocation.data?.[0][me] ?? 0n);
  const canClaim =
    t.phase === 2 &&
    now < t.claimUntil &&
    prize > 0n &&
    !allocation.data?.[1][me];
  const canExpire =
    (t.phase === 0 && !open) || (t.phase === 1 && !running && !ready);
  let settlementStatus = uiText("messageLoadingTheMatchList");
  if (ready)
    settlementStatus = uiText("messageAllConditionsToFinalizePrizesAre");
  else if (!running)
    settlementStatus = uiText("messageTheCompletionDeadlinePassedClosingThe");
  else if (t.openAppeals > 0n)
    settlementStatus = uiText(
      "messageResolveOutstandingAppealsBeforeFinalizingPrizes",
    );
  else if (matches.data && approvedCount < list.length)
    settlementStatus = uiText("messageTheRefereeMustReviewTheRemaining");
  else if (matches.data && t.reviewUntil > now)
    settlementStatus = uiText("messageYouCanFinalizePrizesAfterIf", {
      p0: String(date(t.reviewUntil)),
    });
  const disabled = tx.busy || !address;
  let role = address ? uiText("messageUnregistered") : uiText("messageViewer");
  if (organizer) role = uiText("messageOrganizer2");
  else if (reviewer) role = uiText("messageReferee2");
  else if (me >= 0) role = uiText("messagePlayer");
  else if (relay) role = "Relay";
  else if (contributions.data) role = uiText("messageSponsor2");
  let nextStep = uiText("messageFollowThePrizePoolStandingsAnd");
  if (open) {
    if (organizer && !standing.data)
      nextStep = uiText("messageLoadingThePlayerList");
    else if (organizer && t.funded === 0n)
      nextStep = uiText("messageFundThePrizePoolToOpen");
    else if (organizer && players.length < t.capacity)
      nextStep = uiText("messageMorePlayersNeededToStart", {
        p0: String(t.capacity - players.length),
      });
    else if (organizer) nextStep = uiText("messageTheTournamentIsFullYouCan");
    else if (me >= 0) nextStep = uiText("messageYouAreRegisteredWaitForThe");
    else if (reviewer) nextStep = uiText("messageWaitForTheTournamentToStart");
    else if (!registrationBlock)
      nextStep = uiText("messageYouCanRegisterWithThisWallet");
  } else if (canClaim)
    nextStep = uiText("messageYouCanClaim", { p0: String(amount(prize)) });
  else if (canRefund) nextStep = uiText("messageYouCanReclaimYourShareOf");
  else if (ready) nextStep = settlementStatus;
  else if (running && reviewer && t.openAppeals > 0n)
    nextStep = uiText("messageThereAreAppealsToResolveIn", {
      p0: String(t.openAppeals),
    });
  else if (running && reviewer && waitingReviews > 0)
    nextStep = uiText("messageMatchResultsAreAwaitingYourApproval", {
      p0: String(waitingReviews),
    });
  else if (running && myNextMatch)
    nextStep = uiText("messageOpenYourMatchesAccordingToThe");
  else if (t.phase === 1) nextStep = settlementStatus;
  else if (t.phase === 0) nextStep = uiText("messageRegistrationHasClosed");
  else if (t.phase === 2)
    nextStep = uiText("messageThePrizeAllocationsHaveBeenFinalized");
  else if (t.phase === 3) nextStep = uiText("messageTheTournamentWasCanceled");

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(
        new URL(`/tournaments?id=${id}`, window.location.origin).href,
      );
      setShareStatus("copied");
    } catch {
      setShareStatus("manual");
    }
  }
  async function action(
    functionName:
      | "register"
      | "start"
      | "finalize"
      | "claim"
      | "requestCancellation"
      | "approveCancellation"
      | "cancelExpired"
      | "refund",
  ) {
    if (await tx.send({ functionName, args: [id] })) refresh();
  }
  const fund = handleSubmit(async ({ fund }) => {
    if (await tx.send({ functionName: "fund", args: [id] }, parseEther(fund)))
      refresh();
  });
  const overview = (
    <CardCustom className="grid gap-4">
      {open && (
        <p className="text-sm text-foreground">
          {uiText("messageRegistrationCloses")} {date(t.registrationEnds)}.
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {uiText("messageFunded")}
          </p>
          <strong className="text-status-warning">{amount(t.funded)}</strong>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {uiText("messagePlayer")}
          </p>
          <strong>
            {players.length}/{t.capacity}
          </strong>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">
            {uiText("messageAwarded")}
          </p>
          <strong>{amount(t.paid)}</strong>
        </div>
      </div>
      <div className="rounded-lg border border-status-warning/25 bg-status-warning/5 p-4">
        <p className="eyebrow">{role}</p>
        <p className="mt-1 font-semibold">{nextStep}</p>
        {open &&
          me < 0 &&
          (registrationBlock ? (
            <div className="mt-2 grid gap-1">
              <p className="text-sm text-status-warning">{registrationBlock}</p>
              {needsTestFunds && (
                <a
                  className="text-link w-fit text-sm"
                  href={FUJI_FAUCET_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {uiText("messageGetTestnetAvax")}
                </a>
              )}
            </div>
          ) : (
            <Button
              tone="primary"
              className="mt-3"
              disabled={disabled}
              onClick={() => void action("register")}
            >
              {uiText("messageRegisterForFree")}
            </Button>
          ))}
        {running && myNextMatch && (
          <Link
            className="button-primary mt-3"
            href={`/tournaments/play?id=${id}&room=${myNextMatch.roomId}`}
          >
            {uiText("messageJoinTheMatch")}
          </Link>
        )}
        {canClaim && (
          <Button
            tone="primary"
            className="mt-3"
            disabled={disabled}
            onClick={() => void action("claim")}
          >
            {uiText("messageClaim")} {amount(prize)}
          </Button>
        )}
        {t.phase === 2 && !canClaim && (
          <Button
            tone="primary"
            className="mt-3"
            type="button"
            onClick={() => changeTab("bang-diem")}
          >
            {uiText("messageViewResults")}
          </Button>
        )}
        <div className="mt-2 flex flex-wrap gap-4 text-sm">
          {list.length > 0 && (
            <button
              className="text-link min-h-11"
              type="button"
              onClick={() => changeTab("lich-van")}
            >
              {me >= 0
                ? uiText("messageMyMatches")
                : uiText("messageMatchSchedule")}
            </button>
          )}
          <button
            className="text-link min-h-11"
            type="button"
            onClick={() => changeTab("lich-su")}
          >
            {uiText("messageFundingAndResultsHistory")}
          </button>
          <Link
            className="text-link flex min-h-11 items-center"
            href="/ranking"
          >
            {uiText("messageEloRankings")}
          </Link>
        </div>
      </div>
      <details>
        <summary className="cursor-pointer font-semibold">
          {uiText("messageRulesAndDeadlines")}
        </summary>
        <p className="my-2 whitespace-pre-wrap break-words text-foreground">
          {t.rules}
        </p>
        <p className="text-sm text-foreground">
          {uiText("message50RoundRobinAWin")}{" "}
          {t.capacity === 2
            ? uiText("messageFirstPlace70SecondPlace30")
            : uiText("messageFirstPlace60SecondPlace30")}{" "}
          {uiText("messageTiedPlayersShareTheAffectedPrizes")}
        </p>
        <dl className="mt-3 grid gap-2 text-sm text-muted-foreground">
          <div>
            BTC: <span className="break-all">{t.organizer}</span>
          </div>
          <div>
            {uiText("messageReferee3")}{" "}
            <span className="break-all">{t.reviewer}</span>
          </div>
          <div>
            {uiText("messageRegistrationCloses")} {date(t.registrationEnds)}{" "}
            {uiText("messageCompleteBy")} {date(t.completionDeadline)}
          </div>
          <div>
            {uiText("messageAppealWindowAfterTheLatestResult")}{" "}
            {Number(t.reviewSeconds) / 3600} {uiText("messageHours")}
          </div>
          <div>
            {uiText("messageRulesHash")}{" "}
            <code className="break-all">{t.rulesHash}</code>
          </div>
        </dl>
      </details>
      {t.phase === 1 && (
        <div className="grid gap-2 text-sm text-foreground">
          <p>
            {uiText("messageApproved")} {approvedCount}/{list.length}{" "}
            {uiText("messageMatches")} {t.openAppeals.toString()}{" "}
            {uiText("messageOpenAppeals")}
          </p>
          <p>{settlementStatus}</p>
          {t.reviewUntil > now &&
            (t.openAppeals > 0n || approvedCount < list.length) && (
              <p>
                {uiText("messageAppealsAcceptedUntil")} {date(t.reviewUntil)}.
              </p>
            )}
        </div>
      )}
      {t.phase === 2 && (
        <p className="text-sm text-foreground">
          {uiText("messageClaimPrizesBy")} {date(t.claimUntil)}
          {uiText("messageUnclaimedPrizesAreReturnedInProportion")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {open && me >= 0 && (
          <span className="text-status-success">
            {uiText("messageYouAreRegistered")}
          </span>
        )}
        {ready && (
          <Button
            tone="primary"
            disabled={disabled}
            onClick={() => void action("finalize")}
          >
            {uiText("messageFinalizePrizes")}
          </Button>
        )}
        {canRefund && (
          <Button disabled={disabled} onClick={() => void action("refund")}>
            {uiText("messageClaimSponsorshipRefund")}
          </Button>
        )}
        {canExpire && (
          <Button
            disabled={disabled}
            onClick={() => void action("cancelExpired")}
          >
            {uiText("messageCloseOverdueTournament")}
          </Button>
        )}
      </div>
      {((open && organizer) ||
        (running &&
          !ready &&
          ((organizer && !t.cancellationRequested) ||
            (reviewer && t.cancellationRequested)))) && (
        <details className="rounded-lg border border-foreground/10 p-3">
          <summary className="cursor-pointer font-semibold">
            {uiText("messageManageTournament")}
          </summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {open && organizer && (
              <Button
                tone="primary"
                disabled={
                  disabled || players.length !== t.capacity || t.funded === 0n
                }
                onClick={() => void action("start")}
              >
                {uiText("messageStartTournament")}
              </Button>
            )}
            {organizer &&
              (open || (running && !t.cancellationRequested && !ready)) && (
                <Button
                  disabled={disabled}
                  onClick={() => setConfirmation("requestCancellation")}
                >
                  {open
                    ? uiText("messageCancelTournament")
                    : uiText("messageRequestCancellation")}
                </Button>
              )}
            {running && reviewer && t.cancellationRequested && !ready && (
              <Button
                disabled={disabled}
                onClick={() => setConfirmation("approveCancellation")}
              >
                {uiText("messageApproveCancellation")}
              </Button>
            )}
          </div>
        </details>
      )}
      {open && me < 0 && !reviewer && !!relaySigner.data && !relay && (
        <details className="rounded-lg border border-foreground/10 p-3">
          <summary className="cursor-pointer font-semibold">
            {uiText("messageSponsor3")}
          </summary>
          <form
            className="mt-3 flex flex-wrap items-end gap-2 md:max-w-lg"
            noValidate
            onSubmit={fund}
          >
            <label>
              {uiText("messageFundThePrizePool")}
              {CURRENCY_SYMBOL} test)
              <Input
                inputMode="decimal"
                placeholder="0.02"
                aria-invalid={!!errors.fund}
                {...register("fund", {
                  setValueAs: (value: string) => value.trim(),
                  validate: (value) => {
                    try {
                      if (parseEther(value) > 0n) return true;
                    } catch {}
                    return uiText("messageEnterAPositiveAmountOfTest", {
                      p0: String(CURRENCY_SYMBOL),
                    });
                  },
                })}
              />
              <FieldError message={errors.fund?.message} />
            </label>
            <Button type="submit" disabled={disabled || isSubmitting}>
              {uiText("messageAddFunds")}
            </Button>
          </form>
        </details>
      )}
    </CardCustom>
  );
  const score = (
    <CardCustom id="ket-qua">
      <h2 className="text-description font-semibold">
        {t.phase === 2
          ? uiText("messageFinalResults")
          : uiText("messageProvisionalStandings")}
      </h2>
      <DataWithStatus
        error={standing.isError}
        loading={standing.isPending}
        noData={!players.length && uiText("messageNoPlayersAreRegisteredYet")}
      >
        <Table className="mt-3">
          <TableHeader className="text-muted-foreground">
            <TableRow>
              <TableHead className="py-2">{uiText("messagePlayer")}</TableHead>
              <TableHead>{uiText("messagePoints")}</TableHead>
              <TableHead>Elo Cup</TableHead>
              {t.phase === 2 && <TableHead>{uiText("messagePrize")}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {players
              .map((player, index) => ({
                player,
                index,
                point: points[index] ?? 0n,
              }))
              .sort((a, b) => Number(b.point - a.point))
              .map(({ player, index, point }) => (
                <TableRow
                  className="border-t border-foreground/10"
                  key={player}
                >
                  <TableCell className="py-2 font-mono" title={player}>
                    <Link
                      className="text-link"
                      href={`/profile?wallet=${player}`}
                    >
                      {short(player)}
                    </Link>
                    {me === index && uiText("messageYou2")}
                  </TableCell>
                  <TableCell>{Number(point) / 2}</TableCell>
                  <TableCell>
                    {ratings.get(player.toLowerCase()) ??
                      elo?.startingElo ??
                      "—"}
                  </TableCell>
                  {t.phase === 2 && (
                    <TableCell>
                      {amount(allocation.data?.[0][index] ?? 0n)}
                      {allocation.data?.[1][index] && uiText("messageClaimed")}
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </DataWithStatus>
    </CardCustom>
  );
  const schedule =
    list.length > 0 ? (
      <CardCustom id="lich-dau">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-description font-semibold">
            {uiText("messageMatchSchedule")}
          </h2>
          {me >= 0 && (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label={uiText("messageFilterMatchSchedule")}
            >
              <button
                type="button"
                className={
                  myMatchesOnly ? "button-primary" : "button-secondary"
                }
                aria-pressed={myMatchesOnly}
                onClick={() => setMyMatchesOnly(true)}
              >
                {uiText("messageMyMatches2")}
                {myMatches.length})
              </button>
              <button
                type="button"
                className={
                  myMatchesOnly ? "button-secondary" : "button-primary"
                }
                aria-pressed={!myMatchesOnly}
                onClick={() => setMyMatchesOnly(false)}
              >
                {uiText("messageAll")}
                {list.length})
              </button>
            </div>
          )}
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {uiText("messageEachPairPlaysOnceBothPlayers")}
        </p>
        <details
          className="mb-4 hidden rounded-lg border border-foreground/10 p-3 min-[900px]:block"
          open
        >
          <summary className="cursor-pointer font-semibold">
            {uiText("messageRoundRobinGrid")}
          </summary>
          <DataWithStatus error={matches.isError} loading={matches.isPending}>
            <Table className="min-w-max text-center">
              <caption className="mb-2 text-left text-muted-foreground">
                {uiText("messageSelectAPairToOpenIts")}
              </caption>
              <TableHeader>
                <TableRow>
                  <TableHead scope="col" className="p-2 text-left">
                    {uiText("messagePlayer")}
                  </TableHead>
                  {players.map((player, i) => (
                    <TableHead
                      key={player}
                      scope="col"
                      title={player}
                      className="p-2"
                    >
                      #{i + 1}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {players.map((player, i) => (
                  <TableRow
                    key={player}
                    className="border-t border-foreground/10"
                  >
                    <TableHead
                      scope="row"
                      className="p-2 text-left font-mono"
                      title={player}
                    >
                      #{i + 1} {short(player)}
                    </TableHead>
                    {players.map((opponent, j) => {
                      const match =
                        j > i
                          ? pairs.get(pairKey(player, opponent))
                          : undefined;
                      const label = match?.result.approved
                        ? uiText("messageApproved")
                        : match?.result.reported
                          ? uiText("messageAwaitingReview")
                          : uiText("messageOpenMatch");
                      return (
                        <TableCell key={opponent} className="min-w-16 p-1">
                          {match ? (
                            <Link
                              className={`flex min-h-11 items-center justify-center rounded-dropdown border px-2 py-2 ${statusBadgeClass(match.result.approved ? "success" : match.result.reported ? "warning" : "neutral")}`}
                              href={`/tournaments/play?id=${id}&room=${match.roomId}`}
                              aria-label={uiText("messageMatchVs", {
                                p0: String(match.roomId),
                                p1: String(short(player)),
                                p2: String(short(opponent)),
                                p3: String(label),
                              })}
                            >
                              {label}
                            </Link>
                          ) : (
                            <span
                              aria-hidden="true"
                              className="text-muted-foreground"
                            >
                              —
                            </span>
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataWithStatus>
        </details>
        <ul className="grid gap-2">
          {visibleMatches.map((match) => (
            <li
              key={match.roomId.toString()}
              className="rounded-lg border border-foreground/10 p-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <strong>#{match.roomId.toString()}</strong> · ♔{" "}
                  {short(match.white)} — ♚ {short(match.black)}
                </span>
                <span>
                  {match.result.reported
                    ? `${uiText(outcomes[match.result.outcome])} · ${match.result.approved ? uiText("messageApproved") : uiText("messageAwaitingReview")}`
                    : running
                      ? uiText("messageNoResultYet")
                      : uiText("messageNoResult")}
                </span>
                <Link
                  className="text-link"
                  href={`/tournaments/play?id=${id}&room=${match.roomId}`}
                >
                  {match.result.reported
                    ? uiText("messageReplayMatch")
                    : uiText("messageOpenMatch")}
                </Link>
                <button
                  className="text-link"
                  aria-expanded={selectedMatch === match.roomId}
                  onClick={() =>
                    selectMatch(
                      selectedMatch === match.roomId ? undefined : match.roomId,
                    )
                  }
                >
                  {uiText("messageProfile")}
                </button>
              </div>
              {selectedMatch === match.roomId && (
                <MatchActions
                  key={match.roomId.toString()}
                  match={match}
                  reviewer={reviewer}
                  participant={me >= 0}
                  active={running}
                  appealAllowed={now < t.reviewUntil}
                  tx={tx}
                  refresh={refresh}
                />
              )}
            </li>
          ))}
        </ul>
      </CardCustom>
    ) : (
      <EmptyState
        title={uiText("messageNoScheduleYet")}
        description={uiText("messageTheScheduleAppearsWhenTheOrganizer")}
      />
    );

  return (
    <>
      <CardCustom
        as="div"
        className="flex flex-wrap items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="eyebrow">
            {uiText("messageTournament")}
            {id.toString()} · {uiText(phaseNames[t.phase])}
          </p>
          <h2 className="text-description font-semibold [overflow-wrap:anywhere]">
            {t.title}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={() => void copyShareLink()}>
            {uiText("messageCopyTournamentLink")}
          </Button>
          {shareStatus && (
            <p className="text-sm text-foreground" role="status">
              {uiText(
                shareStatus === "copied"
                  ? "messageTournamentLinkCopied"
                  : "messageOpenTheTournamentAndCopyThe",
              )}
            </p>
          )}
          {shareStatus === "manual" && (
            <Link className="text-link" href={`/tournaments?id=${id}`}>
              {uiText("messageOpenTournamentLink")}
            </Link>
          )}
        </div>
      </CardCustom>
      <Tabs
        label={uiText("messageTournamentDetails")}
        tabs={tabs.map(({ id, label }) => ({ id, label: uiText(label) }))}
        selected={activeTab}
        onChange={changeTab}
        panels={{
          "tong-quan": overview,
          "bang-diem": score,
          "lich-van": schedule,
          "lich-su": (
            <TournamentHistory
              id={id}
              roomIds={list.map((match) => match.roomId)}
            />
          ),
        }}
      />
      {confirmation && (
        <ConfirmDialog
          title={uiText("messageConfirmTournamentCancellation")}
          description={
            confirmation === "approveCancellation"
              ? uiText("messageApproveCancellationAndRefundSponsors")
              : open
                ? uiText("messageCancelRegistrationAndEnableSponsorRefunds")
                : uiText("messageSendACancellationRequestToThe")
          }
          confirmLabel={
            confirmation === "approveCancellation"
              ? uiText("messageApproveCancellation")
              : uiText("messageConfirm")
          }
          disabled={
            disabled ||
            (confirmation === "approveCancellation"
              ? !(running && reviewer && t.cancellationRequested && !ready)
              : !(
                  organizer &&
                  (open || (running && !t.cancellationRequested && !ready))
                ))
          }
          onClose={() => setConfirmation(undefined)}
          onConfirm={() => {
            setConfirmation(undefined);
            void action(confirmation);
          }}
        />
      )}
    </>
  );
}
