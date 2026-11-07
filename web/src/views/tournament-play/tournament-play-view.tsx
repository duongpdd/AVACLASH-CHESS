"use client";

import { isCosmeticsEnabled } from "@/config/cosmetics";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { showApiError } from "@/utils/show-api-error";
import { useCupReplay } from "./hooks/query/use-cup-replay";
import { useAccount, useBlock, useReadContract } from "wagmi";
import { ChessGame, computeMovesHash } from "@avaclash/shared";
import { keccak256, toHex, zeroHash, type Address, type Hex } from "viem";
import Dialog from "@/components/modal-dialog";
import ConfirmDialog from "@/components/confirm-dialog";
import { EmptyState, Skeleton } from "@/components/ui-state";
import MatchActions from "@/components/tournament-match-actions";
import { MatchSkins } from "@/components/cosmetics/match-skins";
import { CosmeticNotice } from "@/components/cosmetics/cosmetic-ui";
import { useSpectatorMoves } from "@/hooks/use-spectator-moves";
import {
  CHAIN_ID,
  NETWORK_NAME,
  TOURNAMENT_ADDRESS,
  tournamentEnabled,
  ZERO_ADDRESS,
} from "@/config/env";
import { useRelaySession } from "@/hooks/use-relay-session";
import { tournamentContract, useTournamentTx } from "@/hooks/use-tournament-tx";
import { parseRoomId } from "@/utils/room";
import { buildTournamentRecord } from "@/utils/tournament-pgn";

const Board = dynamic(() => import("@/components/phaser-game"), {
  ssr: false,
  loading: BoardLoading,
});
const outcomeLabels = [
  "messageWhiteWins",
  "messageBlackWins",
  "messageDraw2",
] as const;
const clock = (ms: number) => {
  const seconds = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

function BoardLoading() {
  const uiText = useUiCopy();
  return <p role="status">{uiText("messageOpeningTheBoard")}</p>;
}

function History({ moves }: { moves: string[] }) {
  const uiText = useUiCopy();
  const sans = useMemo(() => {
    const game = new ChessGame();
    return moves.map((move) => game.makeMove(move)?.san ?? move);
  }, [moves]);
  return (
    <p className="break-words font-mono text-sm leading-loose text-foreground">
      {sans.length
        ? sans
            .map((move, i) => (i % 2 === 0 ? `${i / 2 + 1}. ${move}` : move))
            .join(" ")
        : uiText("messageNoMovesYet2")}
    </p>
  );
}

function LiveMatch({
  roomId,
  tournamentId,
  white,
  black,
  onReported,
  startedAt,
}: {
  roomId: number;
  tournamentId: bigint;
  white: Address;
  black: Address;
  onReported: () => void;
  startedAt: bigint;
}) {
  const uiText = useUiCopy();
  const tx = useTournamentTx();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const session = useRelaySession(roomId, {
    contractAddress: TOURNAMENT_ADDRESS,
  });
  const { resultProposal, relaySignature } = session;
  const validTranscript = useMemo(
    () =>
      !!resultProposal &&
      resultProposal.moveCount === session.moves.length &&
      computeMovesHash(session.moves) === resultProposal.movesHash,
    [resultProposal, session.moves],
  );
  const preview = useMemo(
    () =>
      reviewOpen && resultProposal && validTranscript
        ? buildTournamentRecord(session.moves, {
            roomId,
            tournamentId,
            white,
            black,
            outcome: resultProposal.outcome,
          })
        : null,
    [
      reviewOpen,
      resultProposal,
      validTranscript,
      session.moves,
      roomId,
      tournamentId,
      white,
      black,
    ],
  );
  async function report() {
    if (!resultProposal || !relaySignature || !validTranscript || !preview)
      return;
    const { winner, outcome, reason, moveCount, movesHash, nonce, deadline } =
      resultProposal;
    if (
      await tx.send({
        functionName: "reportResult",
        args: [
          {
            matchId: BigInt(roomId),
            winner: winner as Hex,
            outcome,
            reason,
            moveCount,
            movesHash: movesHash as Hex,
            nonce: BigInt(nonce),
            deadline: BigInt(deadline),
          },
          relaySignature,
        ],
      })
    ) {
      setReviewOpen(false);
      onReported();
    }
  }
  const active =
    session.roomState?.status === "active" && !session.gameFinished;
  const turn = session.moves.length % 2 === 0 ? "w" : "b";
  const flipped = session.myColor === "b";
  function playerCard(color: "w" | "b") {
    const wallet = color === "w" ? white : black;
    const current = active && turn === color;
    const yours = color === session.myColor;
    return (
      <div className={`local-player-card ${current ? "is-active" : ""}`}>
        <span className="local-piece" aria-hidden="true">
          {color === "w" ? "♔" : "♚"}
        </span>
        <div>
          <strong>
            {color === "w" ? uiText("messageWhite") : uiText("messageBlack")}
            {yours ? uiText("messageYou2") : ""}
          </strong>
          <span title={wallet}>
            {wallet.slice(0, 6)}…{wallet.slice(-4)}
            {current ? uiText("messageToMove2") : ""}
          </span>
        </div>
        <time>{clock(color === "w" ? session.whiteMs : session.blackMs)}</time>
      </div>
    );
  }
  return (
    <div className="hotseat-layout">
      <div className="game-board-column space-y-2">
        {playerCard(flipped ? "w" : "b")}
        <div className="rounded-xl border border-foreground/10 bg-card p-2">
          <MatchSkins
            white={white}
            black={black}
            viewer={session.myColor ?? "spectator"}
            start={{ tournamentId, timestamp: startedAt }}
          >
            {(theme) => (
              <Board
                boardSize={560}
                moves={session.moves}
                playerColor={session.myColor}
                flipBoard={session.myColor === "b"}
                canMove={
                  session.roomState?.status === "active" &&
                  session.isMyTurn &&
                  session.isConnected &&
                  !session.gameFinished
                }
                onMove={session.sendMove}
                theme={theme}
              />
            )}
          </MatchSkins>
        </div>
        {playerCard(flipped ? "b" : "w")}
      </div>
      <aside className="surface-card space-y-4">
        <p className="eyebrow">
          {uiText("messageMatch2")}
          {roomId} · 5+0
        </p>
        <p role="status">
          {session.gameFinished
            ? uiText("messageTheMatchHasEndedTheReferee")
            : session.roomState?.status === "active"
              ? uiText("messageMatchInProgress")
              : session.isConnected
                ? uiText("messageWaitingForYourOpponentToJoin")
                : uiText("messageConnectingSignWhenYourWalletPrompts")}
        </p>
        {session.error && (
          <div role="alert" className="text-status-danger">
            {uiText.existing(session.error.message)}
            <button
              className="ml-2 underline"
              onClick={() => {
                session.clearError();
                session.reconnect();
              }}
            >
              {uiText("messageReconnect")}
            </button>
          </div>
        )}
        {session.isDisconnected && !session.error && (
          <Button onClick={session.reconnect}>
            {uiText("messageReconnect")}
          </Button>
        )}
        {session.roomState?.status === "active" && !session.gameFinished && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setResignOpen(true)}>
              {uiText("messageResign")}
            </Button>
            {!session.incomingDrawOffer && (
              <Button onClick={session.sendDrawOffer}>
                {uiText("messageOfferADraw")}
              </Button>
            )}
            {session.incomingDrawOffer && (
              <>
                <Button onClick={session.sendDrawAccept}>
                  {uiText("messageAgreeToADraw")}
                </Button>
                <Button onClick={session.sendDrawDecline}>
                  {uiText("messageDeclineDraw")}
                </Button>
              </>
            )}
          </div>
        )}
        {session.gameFinished && (
          <div className="grid gap-2">
            {resultProposal && (
              <strong>{uiText(outcomeLabels[resultProposal.outcome])}</strong>
            )}
            <Button
              tone="primary"
              disabled={!relaySignature || !validTranscript || tx.busy}
              onClick={() => setReviewOpen(true)}
            >
              {uiText("messageReviewAndSubmitGameRecord")}
            </Button>
            <Button onClick={session.requestResult}>
              {uiText("messageTryFetchingTheResultAgain")}
            </Button>
            <p role="status" className="text-sm text-status-warning">
              {uiText.existing(tx.message)}
            </p>
          </div>
        )}
        <History moves={session.moves} />
      </aside>
      {resignOpen && (
        <ConfirmDialog
          title={uiText("messageConfirmResignation")}
          description={uiText("messageResigningEndsTheMatchAndAwards")}
          confirmLabel={uiText("messageConfirmResignation2")}
          disabled={!active}
          onClose={() => setResignOpen(false)}
          onConfirm={() => {
            setResignOpen(false);
            session.sendResign();
          }}
        />
      )}
      {reviewOpen && (
        <Dialog
          titleId="result-proof-title"
          onClose={() => {
            if (!tx.busy) setReviewOpen(false);
          }}
        >
          <CardCustom
            as="div"
            className="max-h-[85vh] w-full max-w-2xl space-y-3 overflow-y-auto"
          >
            <h2
              id="result-proof-title"
              className="text-description font-semibold"
            >
              {uiText("messageConfirmGameRecordForMatch")}
              {roomId}
            </h2>
            {preview && resultProposal ? (
              <>
                <p>
                  {uiText(outcomeLabels[resultProposal.outcome])} ·{" "}
                  {session.moves.length} {uiText("messageHalfMoves")}
                </p>
                <p className="text-sm text-foreground">
                  {uiText("messageYourWalletSubmitsTheProvisionalResult")}{" "}
                  {NETWORK_NAME}
                  {uiText("messageTheContractStoresTheHashOf")}
                </p>
                <details>
                  <summary className="cursor-pointer py-2">
                    {uiText("messageTechnicalDetails")}
                  </summary>
                  <dl className="space-y-2 text-sm">
                    <div>
                      <dt>{uiText("messageUciMoveHash")}</dt>
                      <dd className="break-all font-mono text-status-warning">
                        {resultProposal.movesHash}
                      </dd>
                    </div>
                    <div>
                      <dt>{uiText("messageFinalFen")}</dt>
                      <dd className="break-all font-mono">{preview.fen}</dd>
                    </div>
                  </dl>
                  <p className="mt-3 text-sm">
                    {uiText("messageProvisionalResultPgn")}
                  </p>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap break-all rounded bg-background p-2 text-xs">
                    {preview.pgn}
                  </pre>
                </details>
              </>
            ) : (
              <p role="status">
                {uiText("messageCouldNotVerifyTheGameRecord")}
              </p>
            )}
            {tx.message && (
              <p role="status" className="text-sm text-status-warning">
                {uiText.existing(tx.message)}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                disabled={tx.busy}
                onClick={() => setReviewOpen(false)}
              >
                {uiText("messageBack")}
              </Button>
              <Button
                type="button"
                tone="primary"
                disabled={!preview || !relaySignature || tx.busy}
                onClick={() => void report()}
              >
                {uiText("messageSignAndSubmitTo")} {NETWORK_NAME}
              </Button>
            </div>
          </CardCustom>
        </Dialog>
      )}
    </div>
  );
}

function SpectatingMatch({
  roomId, tournamentId, startedAt, white, black,
}: {
  roomId: number;
  tournamentId: bigint;
  startedAt: bigint;
  white: Address;
  black: Address;
}) {
  const { moves, status } = useSpectatorMoves(roomId);
  return (
    <div className="game-board-column grid min-w-0 gap-2">
      <p role="status" className="helper-text">
        {status === "live" ? "Đang xem trực tiếp" : status === "finished" ? "Ván đã kết thúc"
          : status === "retrying" ? "Đang kết nối lại để xem ván" : "Đang kết nối để xem ván"}
      </p>
      <MatchSkins white={white} black={black} viewer="spectator" start={{ tournamentId, timestamp: startedAt }}>
        {(theme) => <Board boardSize={560} moves={moves} theme={theme} />}
      </MatchSkins>
    </div>
  );
}

function Replay({
  roomId,
  tournamentId,
  white,
  black,
  outcome,
  committed,
}: {
  roomId: number;
  tournamentId: bigint;
  white: Address;
  black: Address;
  outcome?: number;
  committed: Hex;
}) {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const viewer = address?.toLowerCase() === white.toLowerCase() ? "w"
    : address?.toLowerCase() === black.toLowerCase() ? "b" : "spectator";
  const replay = useCupReplay(roomId);
  useEffect(() => {
    if (replay.isError)
      showApiError(uiText("messageCouldNotLoadTheGameRecord"));
  }, [replay.isError, uiText]);
  const [ply, setPly] = useState<number>();
  const moves = replay.data;
  const computed = useMemo(() => moves && computeMovesHash(moves), [moves]);
  const matches = computed === committed;
  const anchored = committed !== zeroHash;
  const pgnOutcome = anchored && matches ? outcome : undefined;
  const record = useMemo(
    () =>
      moves &&
      buildTournamentRecord(moves, {
        roomId,
        tournamentId,
        white,
        black,
        outcome: pgnOutcome,
      }),
    [moves, roomId, tournamentId, white, black, pgnOutcome],
  );
  if (!moves)
    return (
      <CardCustom as="div" className="space-y-2">
        <p role="status">
          {replay.isPending
            ? uiText("messageLoadingGameRecord")
            : replay.isError
              ? uiText("messageCouldNotLoadTheGameRecord2")
              : uiText("messageTheRelayHasNoGameRecord")}
        </p>
        <Button onClick={() => void replay.refetch()}>
          {uiText("messageReload")}
        </Button>
      </CardCustom>
    );
  if (!record)
    return (
      <p role="alert" className="surface-card">
        {uiText("messageTheGameRecordContainsInvalidMoves")}
      </p>
    );
  const at = Math.min(ply ?? moves.length, moves.length);
  function downloadPgn() {
    if (!record || (anchored && !matches)) return;
    const url = URL.createObjectURL(
      new Blob([record.pgn], { type: "application/x-chess-pgn" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `avaclash-cup-${tournamentId}-van-${roomId}.pgn`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="hotseat-layout">
      <div className="game-board-column rounded-xl border border-foreground/10 bg-card p-2">
        <MatchSkins white={white} black={black} viewer={viewer}>
          {(theme) => <Board boardSize={560} moves={moves.slice(0, at)} theme={theme} />}
        </MatchSkins>
      </div>
      <aside className="surface-card space-y-4">
        <h2 className="text-description font-semibold">
          {uiText("messageGameRecord")}
        </h2>
        <p role="status" className="text-sm text-foreground">
          {!anchored
            ? uiText("messageTheRelayRecordHasNoPublished", {
                p0: String(NETWORK_NAME),
              })
            : matches
              ? uiText("messageTheGameRecordMatchesTheMove", {
                  p0: String(NETWORK_NAME),
                })
              : uiText("messageTheGameRecordDoesNotMatch")}
        </p>
        <dl className="grid gap-2 text-xs text-foreground">
          <div>
            <dt>{uiText("messageOnChainHash")}</dt>
            <dd className="break-all font-mono">
              {anchored ? committed : uiText("messageNotRecorded")}
            </dd>
          </div>
          <div>
            <dt>{uiText("messageHashComputedFromTheRelayRecord")}</dt>
            <dd className="break-all font-mono">{computed}</dd>
          </div>
          <div>
            <dt>{uiText("messageFinalFen")}</dt>
            <dd className="break-all font-mono">{record.fen}</dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {uiText("messageTheHashVerifiesTheUciMove")}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button disabled={anchored && !matches} onClick={downloadPgn}>
            {anchored
              ? uiText("messageDownloadPgn")
              : uiText("messageDownloadUnverifiedPgn")}
          </Button>
          {anchored && !matches && (
            <Button
              disabled={replay.isFetching}
              onClick={() => void replay.refetch()}
            >
              {uiText("messageReloadGameRecord")}
            </Button>
          )}
        </div>
        <label className="block">
          {uiText("messageMove")} {at}/{moves.length}
          <input
            className="block w-full"
            type="range"
            min={0}
            max={moves.length}
            value={at}
            onChange={(e) => setPly(Number(e.target.value))}
          />
        </label>
        <History moves={moves.slice(0, at)} />
      </aside>
    </div>
  );
}

function ReviewPanel({
  roomId,
  tournamentId,
  result,
  refresh,
}: {
  roomId: bigint;
  tournamentId: bigint;
  result: {
    outcome: number;
    approved: boolean;
    reported: boolean;
    decisionHash: Hex;
  };
  refresh: () => void;
}) {
  const uiText = useUiCopy();
  const { address } = useAccount();
  const tx = useTournamentTx();
  const [note, setNote] = useState("");
  const query = { refetchInterval: 6000 } as const;
  const { data: tournament, refetch } = useReadContract({
    ...tournamentContract,
    functionName: "getTournament",
    args: [tournamentId],
    query,
  });
  const { data: registered } = useReadContract({
    ...tournamentContract,
    functionName: "registered",
    args: [tournamentId, address ?? ZERO_ADDRESS],
    query: { ...query, enabled: !!address },
  });
  const { data: block } = useBlock({
    chainId: CHAIN_ID,
    query: { ...query, enabled: !!address },
  });
  const reviewer =
    !!address && address.toLowerCase() === tournament?.reviewer.toLowerCase();
  const active =
    !!block &&
    tournament?.phase === 1 &&
    block.timestamp < tournament.completionDeadline;
  const appealAllowed = active && block.timestamp < tournament.reviewUntil;
  const hasDecision = result.decisionHash !== zeroHash;
  return (
    <CardCustom className="grid gap-3" aria-labelledby="review-title">
      <h2 id="review-title" className="text-description font-semibold">
        {uiText("messageRefereeRecord")}
      </h2>
      <p>
        {result.approved
          ? uiText("messageApproved")
          : result.reported
            ? uiText("messageProvisionalResultAwaitingApproval")
            : uiText("messageNoResultYet")}
      </p>
      {tournament && (
        <p className="break-all text-sm text-foreground">
          {uiText("messageRefereeWallet")} {tournament.reviewer}
        </p>
      )}
      {hasDecision && (
        <div className="grid gap-2 text-sm">
          <p>
            {uiText("messageDecisionHash")}{" "}
            <code className="break-all">{result.decisionHash}</code>
          </p>
          <label className="grid gap-1">
            {uiText("messageVerifyTheOriginalDecision")}
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={500}
              className="w-full rounded-lg border border-foreground/15 bg-background px-3 py-2 text-foreground"
            />
          </label>
          {note.trim() && (
            <p role="status">
              {keccak256(toHex(note.trim())) === result.decisionHash
                ? uiText("messageTheTextMatchesTheDecisionHash")
                : uiText("messageTheTextDoesNotMatchThe")}
            </p>
          )}
        </div>
      )}
      <MatchActions
        match={{ roomId, result }}
        reviewer={reviewer}
        participant={registered === true}
        active={active}
        appealAllowed={appealAllowed}
        tx={tx}
        refresh={() => {
          refresh();
          void refetch();
        }}
      />
      {tx.message && (
        <p role="status" className="text-sm text-status-warning">
          {uiText.existing(tx.message)}
        </p>
      )}
    </CardCustom>
  );
}

function MatchContent() {
  const uiText = useUiCopy();
  const t = useTranslations("pages");
  const params = useSearchParams();
  const roomId = parseRoomId(params.get("room"));
  const { address, chainId } = useAccount();
  const query = {
    enabled: tournamentEnabled && roomId !== undefined,
    refetchInterval: 5000,
  } as const;
  const { data: room, isError } = useReadContract({
    ...tournamentContract,
    functionName: "getRoom",
    args: [BigInt(roomId ?? 0)],
    query,
  });
  const { data: result, refetch } = useReadContract({
    ...tournamentContract,
    functionName: "results",
    args: [BigInt(roomId ?? 0)],
    query,
  });
  if (!tournamentEnabled || roomId === undefined || isError)
    return (
      <EmptyState
        title={uiText("messageNoMatchingTournamentGameFoundOn")}
        action={
          <Link className="button-secondary" href="/tournaments">
            {uiText("messageBackToTournaments")}
          </Link>
        }
      />
    );
  if (!room || !result)
    return <Skeleton label={uiText("messageLoadingMatch")} />;
  const [tournamentId, outcome, reported, approved, movesHash, decisionHash] =
    result;
  const isPlayer = [room.playerA, room.playerB].some(
    (player) => player.toLowerCase() === address?.toLowerCase(),
  );
  const canPlay =
    isPlayer && chainId === CHAIN_ID && room.status === 1 && !reported;
  return (
    <div className="grid gap-4">
      <Link
        className="text-link w-fit"
        href={`/tournaments?id=${tournamentId}`}
      >
        {uiText("messageBackToTournament")}
        {tournamentId.toString()}
      </Link>
      <PageHeader
        eyebrow="AVACLASH CUP"
        title={t("cupMatchTitle", { room: roomId })}
      />
      {reported && (
        <p className="text-status-warning">
          {uiText(outcomeLabels[outcome])} ·{" "}
          {approved
            ? uiText("messageApproved")
            : uiText("messageProvisionalResult")}
        </p>
      )}
      {!reported && room.status === 1 && !canPlay && (
        <p className="text-foreground">
          {uiText("messagePlayersMustUseTheirRegisteredWallet")}
        </p>
      )}
      {canPlay ? (
        <LiveMatch
          key={`${roomId}:${address}`}
          roomId={roomId}
          tournamentId={tournamentId}
          white={room.creatorIsWhite ? room.playerA : room.playerB}
          black={room.creatorIsWhite ? room.playerB : room.playerA}
          startedAt={room.startedAt}
          onReported={() => void refetch()}
        />
      ) : isCosmeticsEnabled() && !reported && room.status === 1 ? (
        <SpectatingMatch
          key={roomId}
          roomId={roomId}
          tournamentId={tournamentId}
          startedAt={room.startedAt}
          white={room.creatorIsWhite ? room.playerA : room.playerB}
          black={room.creatorIsWhite ? room.playerB : room.playerA}
        />
      ) : (
        <>
          <Replay
            key={roomId}
            roomId={roomId}
            tournamentId={tournamentId}
            white={room.creatorIsWhite ? room.playerA : room.playerB}
            black={room.creatorIsWhite ? room.playerB : room.playerA}
            outcome={approved ? outcome : undefined}
            committed={movesHash}
          />
          <ReviewPanel
            key={`${roomId}:${address ?? "viewer"}`}
            roomId={BigInt(roomId)}
            tournamentId={tournamentId}
            result={{ outcome, reported, approved, decisionHash }}
            refresh={() => void refetch()}
          />
        </>
      )}
    </div>
  );
}

export default function TournamentPlayPage() {
  const uiText = useUiCopy();
  return (
    <div className="app-shell">
      <div className="site-container play-page">
        {isCosmeticsEnabled() && <CosmeticNotice />}
        <Suspense fallback={<Skeleton label={uiText("messageOpeningMatch")} />}>
          <MatchContent />
        </Suspense>
      </div>
    </div>
  );
}
