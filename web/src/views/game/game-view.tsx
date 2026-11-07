"use client";
import type { UiText } from "@/i18n/ui-copy";
import { useUiCopy } from "@/i18n/use-ui-copy";
import { Button } from "@/components/ui/button";
import { CURRENCY_SYMBOL } from "@/config/env";

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  Suspense,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useAccount, useChainId } from "wagmi";
import { formatEther } from "viem";
import { ChessGame, codeToReason, type GameOutcome } from "@avaclash/shared";
import type { ChessScene } from "@/game/chess-scene";
import type { CapturedPiece, MaterialStats } from "@/game/game-state";
import WalletBar from "@/components/wallet-bar";
import Icon from "@/components/app-icon";
import Dialog from "@/components/modal-dialog";
import AbortRefundWidget from "@/components/abort-refund-widget";
import { useRoom, ROOM_STATUS_TEXT } from "@/hooks/use-room";
import { useRelaySession } from "@/hooks/use-relay-session";
import { useSubmitResult } from "@/hooks/use-submit-result";
import { useWithdraw } from "@/hooks/use-withdraw";
import { CHAIN_ID } from "@/config/env";
import { parseRoomId } from "@/utils/room";
import { useFairPlayGuard } from "@/hooks/use-fair-play-guard";
import TxStatusAlert from "@/components/tx-status-alert";

// Dynamic import — no SSR for Phaser
const PhaserGame = dynamic(() => import("@/components/phaser-game"), {
  ssr: false,
  loading: BoardLoading,
});

function BoardLoading() {
  const uiText = useUiCopy();
  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 p-4 text-description"
    >
      {uiText("messageOpeningTheBoard")}
    </div>
  );
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getOutcomeMessage(
  outcome: GameOutcome,
  reason: string,
  uiText: UiText,
): string {
  if (outcome === "draw") {
    const reasonMap: Record<string, string> = {
      stalemate: uiText("messageDrawByStalemate"),
      repetition: uiText("messageDrawByThreefoldRepetition"),
      fifty: uiText("messageDrawUnderTheFiftyMoveRule"),
      insufficient: uiText("messageDrawByInsufficientMaterial"),
      draw_agreed: uiText("messageDrawByAgreement"),
    };
    return uiText("messageDraw", { p0: String(reasonMap[reason] ?? reason) });
  }
  const winner =
    outcome === "white" ? uiText("messageWhite") : uiText("messageBlack");
  const reasonMap: Record<string, string> = {
    checkmate: uiText("messageCheckmatedTheOpponent"),
    resign: uiText("messageTheOpponentResigned"),
    timeout: uiText("messageTheOpponentRanOutOfTime"),
  };
  return uiText("messageWins", {
    p0: String(winner),
    p1: String(reasonMap[reason] ?? reason),
  });
}

interface PlayerClockCardProps {
  name: string;
  color: "w" | "b";
  addressText: string;
  timeFormatted: string;
  isActive: boolean;
  isMe: boolean;
  materialAdvantage?: number;
  capturedPieces?: CapturedPiece[];
}

function PlayerClockCard({
  name,
  color,
  addressText,
  timeFormatted,
  isActive,
  isMe,
  materialAdvantage = 0,
  capturedPieces = [],
}: PlayerClockCardProps) {
  const uiText = useUiCopy();
  return (
    <div
      className={`flex flex-col rounded-xl px-4 py-2 transition-all duration-200 ${
        isActive
          ? "bg-muted/90 ring-2 ring-status-warning shadow-lg shadow-status-warning/10"
          : "bg-card/70 border border-foreground/10 opacity-80"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xl shadow-inner ${
              color === "w"
                ? "bg-status-warning text-background border-status-warning"
                : "bg-background text-foreground border-border"
            }`}
          >
            ♚
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground">{name}</span>
              {isMe && (
                <span className="rounded bg-status-warning/20 px-1.5 py-0.5 text-[10px] font-bold text-status-warning border border-status-warning/30">
                  {uiText("messageYou")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[120px] sm:max-w-[180px]">
                {addressText}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums tracking-tight transition-colors ${
            isActive
              ? "bg-status-warning/20 text-status-warning ring-1 ring-status-warning/40"
              : "bg-background/60 text-muted-foreground"
          }`}
        >
          {timeFormatted}
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 text-xs min-h-[18px]">
        <div className="flex flex-wrap items-center gap-0.5">
          {capturedPieces.map((p, i) => (
            <span key={i} className="text-sm leading-none opacity-80">
              {p.symbol}
            </span>
          ))}
        </div>

        {materialAdvantage > 0 && (
          <span className="font-semibold text-status-success text-xs shrink-0">
            +{materialAdvantage}
          </span>
        )}
      </div>
    </div>
  );
}

function GameContent() {
  const searchParams = useSearchParams();
  const roomParam = searchParams.get("room") ?? searchParams.get("roomId");
  const { address } = useAccount();
  return (
    <GameRoom
      key={`${roomParam}:${address ?? "disconnected"}`}
      roomId={parseRoomId(roomParam)}
    />
  );
}

function GameRoom({ roomId }: { roomId?: number }) {
  const uiText = useUiCopy();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const { room, refetch: refetchRoom } = useRoom(roomId);
  const relaySession = useRelaySession(roomId, {
    autoConnect: room?.status === 1 && chainId === CHAIN_ID,
  });
  const sans = useMemo(() => {
    const history = new ChessGame();
    return relaySession.moves.map((uci) => history.makeMove(uci)?.san ?? uci);
  }, [relaySession.moves]);
  const submitResultHook = useSubmitResult(roomId);
  const {
    pendingBalance,
    withdraw,
    step: withdrawStep,
    refetchPending: refetchBalance,
    errorMessage: withdrawError,
    txHash: withdrawTxHash,
  } = useWithdraw();
  const isWithdrawing =
    withdrawStep === "waiting_wallet" || withdrawStep === "confirming";

  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [showDrawOfferModal, setShowDrawOfferModal] = useState(false);
  const [focusAlert, setFocusAlert] = useState(false);
  const [relayErrorToast, setRelayErrorToast] = useState<string | null>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const whiteAddress = room?.creatorIsWhite ? room.playerA : room?.playerB;
  const blackAddress = room?.creatorIsWhite ? room?.playerB : room?.playerA;

  const isWhiteMe = Boolean(
    address &&
    whiteAddress &&
    address.toLowerCase() === whiteAddress.toLowerCase(),
  );
  const isBlackMe = Boolean(
    address &&
    blackAddress &&
    address.toLowerCase() === blackAddress.toLowerCase(),
  );

  const fallbackColor: "w" | "b" | "spectator" = isWhiteMe
    ? "w"
    : isBlackMe
      ? "b"
      : "spectator";

  const effectiveColor: "w" | "b" | "spectator" =
    relaySession.roomState && relaySession.myColor
      ? relaySession.myColor
      : fallbackColor;

  const showToast = useCallback((message: string, durationMs = 4000) => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    setRelayErrorToast(message);
    toastTimeoutRef.current = setTimeout(() => {
      setRelayErrorToast(null);
      toastTimeoutRef.current = null;
    }, durationMs);
  }, []);

  // Auto-dismissing notification for relay errors ("Đến lượt đối thủ", "Nước đi không hợp lệ", ...)
  // Uses relaySession.error ({ message, id }) so repeated identical errors re-trigger toast reliably
  useEffect(() => {
    if (relaySession.error) {
      // Synchronize an external relay error with a dismissible notification timer.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      showToast(relaySession.error.message, 4000);
    }
  }, [relaySession.error, showToast]);

  const handleBlockedInteraction = useCallback(() => {
    showToast(uiText("messageItIsTheOtherPlayerS"), 3000);
  }, [showToast, uiText]);

  const sceneRef = useRef<ChessScene | null>(null);
  const [materialStats, setMaterialStats] = useState<MaterialStats>({
    white: { captured: [], advantage: 0 },
    black: { captured: [], advantage: 0 },
  });

  const sendFocusWarning = relaySession.sendFocusWarning;
  const handleFocusViolation = useCallback(
    (warningCount: number) => {
      setFocusAlert(true);
      sendFocusWarning(warningCount);
    },
    [sendFocusWarning],
  );
  useFairPlayGuard(
    relaySession.isMyTurn && !relaySession.gameFinished,
    handleFocusViolation,
  );

  useEffect(
    () => () => {
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    },
    [],
  );

  const handleSceneReady = useCallback((scene: unknown) => {
    sceneRef.current = scene as ChessScene;
    if (sceneRef.current) {
      setMaterialStats(sceneRef.current.getGameState().getMaterialStats());
    }
  }, []);

  // When relay sends moves, keep board synchronized
  useEffect(() => {
    if (sceneRef.current && relaySession.moves.length > 0) {
      // Update material stats
      setMaterialStats(sceneRef.current.getGameState().getMaterialStats());
    }
  }, [relaySession.moves]);

  // Handle board move from user interaction
  const handleBoardMove = useCallback(
    (uci: string) => {
      if (!relaySession.isMyTurn) {
        return;
      }
      try {
        relaySession.sendMove(uci);
      } catch (err) {
        showToast(
          err instanceof Error
            ? err.message
            : uiText("messageCouldNotSendTheMove"),
        );
      }
    },
    [relaySession, showToast, uiText],
  );

  // If room parameter is missing
  if (roomId === undefined || isNaN(roomId)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <span className="icon-tile">
          <Icon name="board" />
        </span>
        <h2 className="text-description text-xl font-bold text-foreground">
          {uiText("messageChooseARoomToPlay")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {uiText("messageChooseAnOpenRoomOrEnter")}
        </p>
        <Link
          href="/"
          className="rounded-xl bg-status-warning hover:bg-status-warning text-background font-bold px-5 py-2.5 shadow-lg shadow-status-warning/20 transition-all"
        >
          {uiText("messageBackToTheLobby")}
        </Link>
      </div>
    );
  }

  // If wallet not connected
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <span className="icon-tile">
          <Icon name="wallet" />
        </span>
        <h2 className="text-description text-xl font-bold text-foreground">
          {uiText("messageConnectYourWallet")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {uiText("messageConnectYourWalletToAuthenticateMoves")}
        </p>
        <WalletBar />
      </div>
    );
  }

  // If wrong network
  if (chainId !== CHAIN_ID) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-description text-xl font-bold text-status-danger">
          {uiText("messageWrongNetwork")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {uiText("messageYourWalletIsConnectedToChain")}{" "}
          <span className="font-mono text-foreground">{chainId}</span>
          {uiText("messageSwitchYourWalletToTheRequired")}
          <span className="font-mono text-status-warning">{CHAIN_ID}</span>).
        </p>
      </div>
    );
  }

  const isCancelledOrRefunded = Boolean(
    room && (room.status === 3 || room.status === 4 || room.status === 6),
  );

  const isGameOver =
    !isCancelledOrRefunded &&
    (relaySession.gameFinished ||
      relaySession.roomState?.status === "finished" ||
      room?.status === 2);
  const canPlay =
    room?.status === 1 &&
    !isGameOver &&
    !isCancelledOrRefunded &&
    relaySession.roomState?.status === "active" &&
    relaySession.isConnected &&
    effectiveColor !== "spectator";
  const canSettle = (isWhiteMe || isBlackMe) && (room?.status === 1 || !room);
  const proposal = relaySession.resultProposal;
  const outcomeMessage = proposal
    ? getOutcomeMessage(
        proposal.outcome === 2
          ? "draw"
          : proposal.outcome === 0
            ? "white"
            : "black",
        codeToReason(proposal.reason),
        uiText,
      )
    : undefined;

  const roomStatus = room && ROOM_STATUS_TEXT[room.status];
  const whiteName = isWhiteMe
    ? uiText("messageYouWhite")
    : uiText("messageWhitePlayer");
  const blackName = isBlackMe
    ? uiText("messageYouBlack")
    : uiText("messageBlackPlayer");

  const topPlayer = effectiveColor === "b" ? "w" : "b";
  const bottomPlayer = effectiveColor === "b" ? "b" : "w";

  return (
    <div className="flex flex-col gap-4 max-w-6xl w-full mx-auto">
      {/* Reconnection Banner */}
      {relaySession.isReconnecting && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/20 px-4 py-2 text-status-warning text-xs font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span>🔄</span>
            <span>{uiText("messageReconnectingToTheRelayTheClock")}</span>
          </div>
          <button
            onClick={relaySession.reconnect}
            className="rounded bg-status-warning text-background font-bold px-2 py-0.5 text-[11px] hover:bg-status-warning"
          >
            {uiText("messageRetryNow")}
          </button>
        </div>
      )}

      {/* Focus Alert Banner */}
      {focusAlert && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/20 px-4 py-2 text-status-warning text-xs flex items-center gap-2">
          <span>👀</span>
          <span>{uiText("messageFairPlayWarningYouSwitchedAway")}</span>
          <button
            onClick={() => setFocusAlert(false)}
            aria-label={uiText("messageDismissFairPlayWarning")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Relay Error Toast Notification */}
      {relayErrorToast && (
        <div
          role="alert"
          aria-live="assertive"
          className="rounded-xl border border-status-danger/50 bg-status-danger/80 px-4 py-2.5 text-status-danger text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg shadow-rose-950/40 animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span className="font-medium">
              {uiText.existing(relayErrorToast)}
            </span>
          </div>
          <button
            onClick={() => setRelayErrorToast(null)}
            className="text-status-danger hover:text-status-danger text-xs font-bold px-1.5 py-0.5 rounded border border-status-danger/30 hover:border-status-danger transition-colors"
            title={uiText("messageDismissNotification")}
          >
            ✕
          </button>
        </div>
      )}

      {/* Incoming Draw Offer Modal / Banner */}
      {relaySession.incomingDrawOffer && !isGameOver && (
        <div className="rounded-xl border border-status-info/40 bg-status-info/20 p-3 text-foreground flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>🤝</span>
            <span>{uiText("messageYourOpponentOfferedADrawDo")}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={relaySession.sendDrawAccept}
              className="rounded-lg bg-status-success hover:bg-status-success px-3 py-1.5 text-xs font-bold text-background shadow"
            >
              {uiText("messageAcceptDraw")}
            </button>
            <button
              onClick={relaySession.sendDrawDecline}
              className="rounded-lg bg-muted hover:bg-muted px-3 py-1.5 text-xs font-bold text-foreground"
            >
              {uiText("messageDecline")}
            </button>
          </div>
        </div>
      )}

      {/* Abort / Refund Guard when room is Active but game not started */}
      {room && (
        <AbortRefundWidget
          roomId={roomId}
          room={room}
          onSuccess={() => refetchRoom()}
        />
      )}

      <div className="arena-status" role="status">
        <span
          className={`h-1.5 w-1.5 rounded-full ${relaySession.isConnected ? "bg-status-success" : "bg-status-warning"}`}
        />
        <strong className="mr-auto font-medium text-foreground">
          {uiText("messageRoom")}
          {roomId}
        </strong>
        <span className="text-muted-foreground">
          {relaySession.connectionStatus === "awaiting_signature"
            ? uiText("messageWaitingForYourSignatureNoFees")
            : room?.status === 0
              ? uiText("messageWaitingForAnOpponent")
              : relaySession.roomState?.status === "waiting"
                ? uiText("messageWaitingForTheOpponentToSign")
                : relaySession.isConnected
                  ? uiText("messageConnected")
                  : uiText("messageDisconnectedFromTheMatchServer")}
        </span>
      </div>
      {/* Main Game Arena */}
      <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-5 w-full">
        {/* Left: Clock Cards & Board */}
        <div className="game-board-column flex flex-col gap-2 w-full shrink-0">
          {/* Top Clock Card */}
          <PlayerClockCard
            name={topPlayer === "w" ? whiteName : blackName}
            color={topPlayer}
            addressText={
              (topPlayer === "w" ? whiteAddress : blackAddress) ||
              uiText("messageWaiting")
            }
            timeFormatted={formatTime(
              topPlayer === "w" ? relaySession.whiteMs : relaySession.blackMs,
            )}
            isActive={
              relaySession.roomState?.status === "active" &&
              (topPlayer === "w"
                ? relaySession.moves.length % 2 === 0
                : relaySession.moves.length % 2 === 1)
            }
            isMe={topPlayer === "w" ? !!isWhiteMe : !!isBlackMe}
            materialAdvantage={
              topPlayer === "w"
                ? materialStats.white.advantage
                : materialStats.black.advantage
            }
            capturedPieces={
              topPlayer === "w"
                ? materialStats.white.captured
                : materialStats.black.captured
            }
          />

          {/* Phaser Board Container */}
          <div className="relative aspect-square w-full rounded-xl p-2 bg-card/90 border border-foreground/15 shadow-2xl flex items-center justify-center overflow-hidden">
            <PhaserGame
              boardSize={560}
              flipBoard={effectiveColor === "b"}
              moves={relaySession.moves}
              playerColor={effectiveColor}
              canMove={
                canPlay &&
                relaySession.isMyTurn &&
                relaySession.roomState?.status === "active" &&
                relaySession.connectionStatus === "connected"
              }
              onMove={handleBoardMove}
              onSceneReady={handleSceneReady}
              onBlockedInteraction={handleBlockedInteraction}
            />

            {!relaySession.isConnected && !isGameOver && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10">
                <span className="h-3 w-3 rounded-full bg-status-warning animate-ping mb-3" />
                <p className="text-sm font-semibold text-status-warning">
                  {relaySession.connectionStatus === "awaiting_signature"
                    ? uiText("messageOpenMetamaskOrCoreAndSign")
                    : room?.status === 0
                      ? uiText("messageWaitingForTheOpponentToDeposit")
                      : relaySession.connectionStatus === "connecting"
                        ? uiText("messageConnectingToTheRelay")
                        : uiText("messageLostConnectionToTheRelayReconnect")}
                </p>
                {relaySession.error && (
                  <p role="alert" className="mt-3 text-xs text-status-danger">
                    {uiText.existing(relaySession.error.message)}
                  </p>
                )}
                {room?.status === 1 &&
                  relaySession.connectionStatus !== "awaiting_signature" && (
                    <button
                      onClick={relaySession.reconnect}
                      className="mt-4 rounded-lg bg-status-warning px-4 py-2 text-sm font-bold text-background"
                    >
                      {uiText("messageReconnect")}
                    </button>
                  )}
              </div>
            )}
          </div>

          {relaySession.roomState?.status === "waiting" && (
            <p
              role="status"
              className="text-center text-xs text-status-warning"
            >
              {uiText("messageYouAreAuthenticatedWaitingForYour")}
            </p>
          )}

          {/* Bottom Clock Card */}
          <PlayerClockCard
            name={bottomPlayer === "w" ? whiteName : blackName}
            color={bottomPlayer}
            addressText={
              (bottomPlayer === "w" ? whiteAddress : blackAddress) ||
              uiText("messageWaiting")
            }
            timeFormatted={formatTime(
              bottomPlayer === "w"
                ? relaySession.whiteMs
                : relaySession.blackMs,
            )}
            isActive={
              relaySession.roomState?.status === "active" &&
              (bottomPlayer === "w"
                ? relaySession.moves.length % 2 === 0
                : relaySession.moves.length % 2 === 1)
            }
            isMe={bottomPlayer === "w" ? !!isWhiteMe : !!isBlackMe}
            materialAdvantage={
              bottomPlayer === "w"
                ? materialStats.white.advantage
                : materialStats.black.advantage
            }
            capturedPieces={
              bottomPlayer === "w"
                ? materialStats.white.captured
                : materialStats.black.captured
            }
          />
        </div>

        {/* Right: Room Status, Controls & Settlement */}
        <div className="flex flex-col gap-4 w-full max-w-[560px] lg:max-w-[340px]">
          {/* Room Header Info */}
          <div className="rounded-xl border border-foreground/10 bg-card/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {uiText("messageMatchDetails")}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                  room?.status !== undefined
                    ? ROOM_STATUS_TEXT[room.status]?.color
                    : "text-muted-foreground border-foreground/10"
                }`}
              >
                {roomStatus
                  ? uiText.existing(roomStatus.label)
                  : uiText("messageLoading")}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-foreground">
              <span>{uiText("messageRoomStake")}</span>
              <span className="font-mono font-bold text-status-warning">
                {room?.stake ? formatEther(room.stake) : "0"} {CURRENCY_SYMBOL}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-foreground">
              <span>{uiText("messageYourSide")}</span>
              <span className="font-bold text-foreground">
                {effectiveColor === "w"
                  ? uiText("messageWhiteMovesFirst")
                  : effectiveColor === "b"
                    ? uiText("messageBlackMovesSecond")
                    : uiText("messageSpectator")}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-foreground">
              <span>{uiText("messageTurn")}</span>
              <span className="font-bold">
                {relaySession.moves.length % 2 === 0
                  ? uiText("messageWhite")
                  : uiText("messageBlack")}{" "}
                {relaySession.isMyTurn && (
                  <span className="text-status-warning">
                    {uiText("messageYourTurn")}
                  </span>
                )}
              </span>
            </div>
          </div>

          {/* Action Buttons (Active Game) */}
          {!isGameOver && !isCancelledOrRefunded && (
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={() => setShowResignConfirm(true)}
                disabled={!canPlay}
                className="!border-status-danger/25 !text-status-danger"
              >
                {uiText("messageResign")}
              </Button>

              <Button
                onClick={() => setShowDrawOfferModal(true)}
                disabled={!canPlay}
              >
                {uiText("messageOfferADraw")}
              </Button>
            </div>
          )}

          {/* Cancelled / Refunded / Aborted Room Section */}
          {isCancelledOrRefunded && (
            <div className="rounded-xl border border-border bg-card/80 p-4 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-status-warning font-bold text-sm">
                <span>🚫</span>
                <span>{uiText("messageRoomCanceledOrRefunded")}</span>
              </div>

              <p className="text-xs text-foreground">
                {uiText("messageThisRoomHasBeen")}{" "}
                {roomStatus
                  ? uiText.existing(roomStatus.label)
                  : uiText("messageCanceledOrRefunded")}
                {uiText("messageStakesWereReturnedToThePlayers")}
              </p>

              {/* Withdrawal info when cancelled/refunded */}
              <div className="border-t border-foreground/10 pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {uiText("messageWithdrawableBalance")}
                  </span>
                  <span className="font-mono font-bold text-status-success">
                    {formatEther(pendingBalance)} {CURRENCY_SYMBOL}
                  </span>
                </div>
                {pendingBalance > BigInt(0) && (
                  <button
                    onClick={() => withdraw()}
                    disabled={isWithdrawing}
                    className="w-full py-2 px-3 rounded-xl bg-status-success hover:bg-status-success text-background font-bold text-xs shadow transition-all disabled:opacity-50"
                  >
                    {isWithdrawing
                      ? uiText("messageWithdrawing")
                      : uiText("messageWithdrawToWallet")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Game Over & Submit Result Section */}
          {isGameOver && (
            <div className="rounded-xl border border-status-warning/40 bg-gradient-to-br from-card to-status-warning/40 p-4 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-status-warning font-bold text-sm">
                <span>🏆</span>
                <span>{uiText("messageMatchEnded")}</span>
              </div>

              <p className="text-xs text-foreground">
                {relaySession.resultProposal
                  ? outcomeMessage
                  : uiText("messageTheGameIsCompleteVerifyAnd")}
              </p>

              {/* Submit Result Action */}
              {room?.status === 2 ? (
                <p className="text-xs font-semibold text-status-success">
                  {uiText("messageSubmittedAndConfirmedOnChain")}
                </p>
              ) : relaySession.resultProposal && relaySession.relaySignature ? (
                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => {
                      submitResultHook.submit({
                        proposal: relaySession.resultProposal!,
                        relaySignature: relaySession.relaySignature!,
                        moves: relaySession.moves,
                        white: (whiteAddress || "0x0") as `0x${string}`,
                        black: (blackAddress || "0x0") as `0x${string}`,
                        seenEvents: relaySession.seenEvents,
                        onRequestNewResult: relaySession.requestResult,
                        refetchRoom,
                        refetchBalance,
                      });
                    }}
                    disabled={
                      submitResultHook.isSubmitting ||
                      submitResultHook.isSuccess ||
                      room?.status === 2 ||
                      !canSettle
                    }
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-status-warning to-status-warning hover:from-status-warning hover:to-status-warning text-muted-foreground font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                  >
                    {room?.status === 2 ||
                    uiText.existing(submitResultHook.statusMessage ?? "") ===
                      uiText("messageSubmitted")
                      ? uiText("messageSubmitted")
                      : submitResultHook.isSubmitting
                        ? uiText("messageVerifyingAndSubmitting")
                        : uiText("messageSignAndSubmitResult2Of")}
                  </button>

                  {submitResultHook.needsNewProposal && (
                    <button
                      onClick={relaySession.requestResult}
                      className="w-full py-1.5 px-3 rounded-lg bg-muted hover:bg-muted text-status-warning text-xs font-semibold"
                    >
                      {uiText("messageRequestANewSignatureFromThe")}
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={relaySession.requestResult}
                  disabled={!canSettle || !relaySession.isConnected}
                  className="w-full py-2 px-3 rounded-lg bg-status-warning/20 hover:bg-status-warning/30 text-status-warning font-bold text-xs border border-status-warning/40"
                >
                  {uiText("messageGetTheResultSignatureFromThe")}
                </button>
              )}

              {submitResultHook.error && (
                <div className="rounded-lg bg-status-danger/20 border border-status-danger/40 p-2 text-status-danger text-xs">
                  ⚠️ {submitResultHook.error}
                </div>
              )}

              {/* Withdrawal info when settled */}
              <div className="border-t border-foreground/10 pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    {uiText("messageWithdrawableBalance")}
                  </span>
                  <span className="font-mono font-bold text-status-success">
                    {formatEther(pendingBalance)} {CURRENCY_SYMBOL}
                  </span>
                </div>
                {pendingBalance > BigInt(0) && (
                  <button
                    onClick={() => withdraw()}
                    disabled={isWithdrawing}
                    className="w-full py-2 px-3 rounded-lg bg-status-success hover:bg-status-success text-background font-bold text-xs shadow"
                  >
                    {isWithdrawing
                      ? uiText("messageWithdrawing2")
                      : uiText("messageWithdrawToWallet")}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Moves List History */}
          <div className="rounded-xl border border-foreground/10 bg-card/70 p-4 flex-1 flex flex-col min-h-[160px] max-h-[260px] overflow-hidden">
            <span className="text-xs font-bold text-foreground mb-2">
              {uiText("messageMoveHistory")}
              {relaySession.moves.length})
            </span>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-muted-foreground space-y-1 pr-1">
              {sans.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-0.5 border-b border-foreground/5"
                >
                  <span className="text-muted-foreground">#{i + 1}</span>
                  <span className="text-foreground">{m}</span>
                </div>
              ))}
              {relaySession.moves.length === 0 && (
                <div className="text-muted-foreground text-center py-6">
                  {uiText("messageNoMovesYet")}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <TxStatusAlert
        step={withdrawStep}
        errorMessage={withdrawError}
        txHash={withdrawTxHash}
      />
      {submitResultHook.txHash && (
        <TxStatusAlert
          step={
            submitResultHook.isSuccess
              ? "success"
              : submitResultHook.error
                ? "error"
                : "confirming"
          }
          errorMessage={submitResultHook.error}
          txHash={submitResultHook.txHash}
        />
      )}

      {/* Resign Confirm Dialog */}
      {showResignConfirm && (
        <Dialog
          titleId="resign-title"
          onClose={() => setShowResignConfirm(false)}
        >
          <div className="rounded-2xl border border-status-danger/40 bg-card p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3
              id="resign-title"
              className="text-base font-bold text-status-danger"
            >
              {uiText("messageConfirmResignation")}
            </h3>
            <p className="text-xs text-foreground">
              {uiText("messageResignThisMatchYourOpponentWill")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResignConfirm(false)}
                className="py-1.5 px-3 rounded-lg bg-muted text-foreground text-xs font-bold"
              >
                {uiText("messageCancel")}
              </button>
              <button
                onClick={() => {
                  setShowResignConfirm(false);
                  relaySession.sendResign();
                }}
                className="py-1.5 px-3 rounded-lg bg-status-danger text-background text-xs font-bold"
              >
                {uiText("messageConfirmResignation2")}
              </button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Offer Draw Modal */}
      {showDrawOfferModal && (
        <Dialog
          titleId="draw-title"
          onClose={() => setShowDrawOfferModal(false)}
        >
          <div className="rounded-2xl border border-foreground/10 bg-card p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 id="draw-title" className="text-base font-bold text-foreground">
              {uiText("messageSendDrawOffer")}
            </h3>
            <p className="text-xs text-foreground">
              {uiText("messageOfferYourOpponentADrawIf")}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDrawOfferModal(false)}
                className="py-1.5 px-3 rounded-lg bg-muted text-foreground text-xs font-bold"
              >
                {uiText("messageClose")}
              </button>
              <button
                onClick={() => {
                  setShowDrawOfferModal(false);
                  relaySession.sendDrawOffer();
                }}
                className="py-1.5 px-3 rounded-lg bg-status-warning text-background text-xs font-bold"
              >
                {uiText("messageSendDrawOffer")}
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default function GamePage() {
  const uiText = useUiCopy();
  return (
    <div className="app-shell game-shell">
      <div className="site-container flex-1 min-h-0 flex justify-center py-6">
        <Suspense
          fallback={
            <div className="text-sm text-muted-foreground animate-pulse">
              {uiText("messageLoadingMatchDetails")}
            </div>
          }
        >
          <GameContent />
        </Suspense>
      </div>
    </div>
  );
}
