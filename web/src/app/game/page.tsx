"use client";
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
import type { ChessScene } from "@/game/ChessScene";
import type { CapturedPiece, MaterialStats } from "@/game/GameState";
import FujiTestnetBanner from "@/components/FujiTestnetBanner";
import WalletBar from "@/components/WalletBar";
import AppHeader from "@/components/AppHeader";
import Icon from "@/components/Icon";
import Dialog from "@/components/Dialog";
import AbortRefundWidget from "@/components/AbortRefundWidget";
import { useRoom, ROOM_STATUS_TEXT } from "@/hooks/useRoom";
import { useRelaySession } from "@/hooks/useRelaySession";
import { useSubmitResult } from "@/hooks/useSubmitResult";
import { useWithdraw } from "@/hooks/useWithdraw";
import { CHAIN_ID } from "@/config/env";
import { parseRoomId } from "@/utils/room";
import { useFairPlayGuard } from "@/hooks/useFairPlayGuard";
import TxStatusAlert from "@/components/TxStatusAlert";

// Dynamic import — no SSR for Phaser
const PhaserGame = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-square bg-slate-950/80 rounded-lg flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
        Đang mở bàn cờ…
      </div>
    </div>
  ),
});

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getOutcomeMessage(outcome: GameOutcome, reason: string): string {
  if (outcome === "draw") {
    const reasonMap: Record<string, string> = {
      stalemate: "Hòa do hết nước đi (Stalemate)",
      repetition: "Hòa do lặp lại thế cờ 3 lần",
      fifty: "Hòa theo quy tắc 50 nước",
      insufficient: "Hòa do thiếu lực lượng bắt buộc",
      draw_agreed: "Hòa theo thỏa thuận hai bên",
    };
    return `Hòa — ${reasonMap[reason] ?? reason}`;
  }
  const winner = outcome === "white" ? "Trắng" : "Đen";
  const reasonMap: Record<string, string> = {
    checkmate: "Chiếu hết đối thủ",
    resign: "Đối thủ đầu hàng",
    timeout: "Đối thủ hết thời gian",
  };
  return `${winner} Thắng — ${reasonMap[reason] ?? reason}`;
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
  return (
    <div
      className={`flex flex-col rounded-xl px-4 py-2 transition-all duration-200 ${
        isActive
          ? "bg-slate-800/90 ring-2 ring-amber-400 shadow-lg shadow-amber-500/10"
          : "bg-slate-900/70 border border-white/10 opacity-80"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xl shadow-inner ${
              color === "w"
                ? "bg-amber-50 text-slate-900 border-amber-200"
                : "bg-slate-950 text-slate-100 border-slate-700"
            }`}
          >
            ♚
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">{name}</span>
              {isMe && (
                <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                  BẠN
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] font-mono text-slate-400 truncate max-w-[120px] sm:max-w-[180px]">
                {addressText}
              </span>
            </div>
          </div>
        </div>

        <div
          className={`rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums tracking-tight transition-colors ${
            isActive
              ? "bg-amber-400/20 text-amber-300 ring-1 ring-amber-400/40"
              : "bg-slate-950/60 text-slate-400"
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
          <span className="font-semibold text-emerald-400 text-xs shrink-0">
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
  const [focusAlert, setFocusAlert] = useState<string | null>(null);
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
    showToast("Chưa đến lượt bạn", 3000);
  }, [showToast]);

  const sceneRef = useRef<ChessScene | null>(null);
  const [materialStats, setMaterialStats] = useState<MaterialStats>({
    white: { captured: [], advantage: 0 },
    black: { captured: [], advantage: 0 },
  });

  const sendFocusWarning = relaySession.sendFocusWarning;
  const handleFocusViolation = useCallback(
    (warningCount: number) => {
      setFocusAlert(
        "Cảnh báo fair-play: Bạn đang rời khỏi màn hình trận đấu. Hãy tập trung để duy trì tính công bằng!",
      );
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
          err instanceof Error ? err.message : "Không thể gửi nước đi.",
        );
      }
    },
    [relaySession, showToast],
  );

  // If room parameter is missing
  if (roomId === undefined || isNaN(roomId)) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto space-y-4">
        <span className="icon-tile">
          <Icon name="board" />
        </span>
        <h2 className="text-xl font-bold text-slate-100">
          Chưa chọn phòng thi đấu
        </h2>
        <p className="text-sm text-slate-400">
          Chọn một phòng đang mở hoặc nhập mã mà bạn bè đã gửi để bắt đầu.
        </p>
        <Link
          href="/"
          className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-5 py-2.5 shadow-lg shadow-amber-500/20 transition-all"
        >
          Về phòng chờ
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
        <h2 className="text-xl font-bold text-slate-100">Yêu cầu kết nối ví</h2>
        <p className="text-sm text-slate-400">
          Nối ví để xác thực vào phòng. Nước đi không cần ký hoặc trả phí mạng.
          Khi kết thúc, bạn sẽ ký và gửi kết quả.
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
        <h2 className="text-xl font-bold text-rose-400">Sai mạng kết nối</h2>
        <p className="text-sm text-slate-400">
          Ví của bạn đang kết nối vào Chain ID:{" "}
          <span className="font-mono text-white">{chainId}</span>. Vui lòng
          chuyển ví sang mạng mục tiêu (
          <span className="font-mono text-amber-400">{CHAIN_ID}</span>).
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
      )
    : undefined;

  const whiteName = isWhiteMe ? "Bạn (Trắng)" : "Người chơi Trắng";
  const blackName = isBlackMe ? "Bạn (Đen)" : "Người chơi Đen";

  const topPlayer = effectiveColor === "b" ? "w" : "b";
  const bottomPlayer = effectiveColor === "b" ? "b" : "w";

  return (
    <div className="flex flex-col gap-4 max-w-6xl w-full mx-auto">
      {/* Reconnection Banner */}
      {relaySession.isReconnecting && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/20 px-4 py-2 text-amber-300 text-xs font-semibold flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <span>🔄</span>
            <span>
              Đang kết nối lại với máy chủ relay... Đồng hồ vẫn tiếp tục tính
              giờ theo dữ liệu mới nhất.
            </span>
          </div>
          <button
            onClick={relaySession.reconnect}
            className="rounded bg-amber-400 text-slate-950 font-bold px-2 py-0.5 text-[11px] hover:bg-amber-300"
          >
            Thử lại ngay
          </button>
        </div>
      )}

      {/* Focus Alert Banner */}
      {focusAlert && (
        <div className="rounded-xl border border-orange-500/40 bg-orange-500/20 px-4 py-2 text-orange-200 text-xs flex items-center gap-2">
          <span>👀</span>
          <span>{focusAlert}</span>
          <button
            onClick={() => setFocusAlert(null)}
            aria-label="Đóng cảnh báo fair-play"
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
          className="rounded-xl border border-rose-500/50 bg-rose-950/80 px-4 py-2.5 text-rose-200 text-xs sm:text-sm flex items-center justify-between gap-3 shadow-lg shadow-rose-950/40 animate-fade-in"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">⚠️</span>
            <span className="font-medium">{relayErrorToast}</span>
          </div>
          <button
            onClick={() => setRelayErrorToast(null)}
            className="text-rose-400 hover:text-rose-100 text-xs font-bold px-1.5 py-0.5 rounded border border-rose-500/30 hover:border-rose-400 transition-colors"
            title="Đóng thông báo"
          >
            ✕
          </button>
        </div>
      )}

      {/* Incoming Draw Offer Modal / Banner */}
      {relaySession.incomingDrawOffer && !isGameOver && (
        <div className="rounded-xl border border-blue-500/40 bg-blue-500/20 p-3 text-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span>🤝</span>
            <span>
              Đối thủ vừa gửi lời đề nghị HÒA. Bạn có đồng ý kết thúc hòa không?
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={relaySession.sendDrawAccept}
              className="rounded-lg bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow"
            >
              Chấp nhận hòa
            </button>
            <button
              onClick={relaySession.sendDrawDecline}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-1.5 text-xs font-bold text-slate-200"
            >
              Từ chối
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
          className={`h-1.5 w-1.5 rounded-full ${relaySession.isConnected ? "bg-emerald-400" : "bg-amber-300"}`}
        />
        <strong className="mr-auto font-medium text-slate-300">
          Phòng #{roomId}
        </strong>
        <span className="text-slate-400">
          {relaySession.connectionStatus === "awaiting_signature"
            ? "Chờ bạn ký vào trận · Không mất phí"
            : room?.status === 0
              ? "Chờ đối thủ tham gia"
              : relaySession.roomState?.status === "waiting"
                ? "Chờ đối thủ ký vào trận"
                : relaySession.isConnected
                  ? "Đã kết nối"
                  : "Chưa kết nối máy chủ trận đấu"}
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
              (topPlayer === "w" ? whiteAddress : blackAddress) || "Đang chờ..."
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
          <div className="relative aspect-square w-full rounded-xl p-2 bg-slate-900/90 border border-white/15 shadow-2xl flex items-center justify-center overflow-hidden">
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
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center p-4 text-center z-10">
                <span className="h-3 w-3 rounded-full bg-amber-400 animate-ping mb-3" />
                <p className="text-sm font-semibold text-amber-200">
                  {relaySession.connectionStatus === "awaiting_signature"
                    ? "Mở MetaMask/Core và ký yêu cầu AvaClashRelay / Join để vào phòng (không mất phí)."
                    : room?.status === 0
                      ? "Đang chờ đối thủ nạp cược vào phòng."
                      : relaySession.connectionStatus === "connecting"
                        ? "Đang kết nối tới máy chủ Relay..."
                        : "Mất kết nối với Relay. Vui lòng kết nối lại để tiếp tục."}
                </p>
                {relaySession.error && (
                  <p role="alert" className="mt-3 text-xs text-rose-300">
                    {relaySession.error.message}
                  </p>
                )}
                {room?.status === 1 &&
                  relaySession.connectionStatus !== "awaiting_signature" && (
                    <button
                      onClick={relaySession.reconnect}
                      className="mt-4 rounded-lg bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950"
                    >
                      Kết nối lại
                    </button>
                  )}
              </div>
            )}
          </div>

          {relaySession.roomState?.status === "waiting" && (
            <p role="status" className="text-center text-xs text-amber-200">
              Bạn đã xác thực. Đang chờ đối thủ mở cùng phòng và ký Join trong
              ví.
            </p>
          )}

          {/* Bottom Clock Card */}
          <PlayerClockCard
            name={bottomPlayer === "w" ? whiteName : blackName}
            color={bottomPlayer}
            addressText={
              (bottomPlayer === "w" ? whiteAddress : blackAddress) ||
              "Đang chờ..."
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
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Thông tin trận</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border font-bold ${
                  room?.status !== undefined
                    ? ROOM_STATUS_TEXT[room.status]?.color
                    : "text-slate-400 border-white/10"
                }`}
              >
                {room?.status !== undefined
                  ? ROOM_STATUS_TEXT[room.status]?.label
                  : "Đang tải..."}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Mức cược phòng:</span>
              <span className="font-mono font-bold text-amber-300">
                {room?.stake ? formatEther(room.stake) : "0"} {CURRENCY_SYMBOL}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Quân của bạn:</span>
              <span className="font-bold text-slate-100">
                {effectiveColor === "w"
                  ? "Trắng · Đi trước"
                  : effectiveColor === "b"
                    ? "Đen · Đi sau"
                    : "Khán giả"}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-300">
              <span>Lượt đi:</span>
              <span className="font-bold">
                {relaySession.moves.length % 2 === 0 ? "Trắng" : "Đen"}{" "}
                {relaySession.isMyTurn && (
                  <span className="text-amber-400">(Lượt của bạn)</span>
                )}
              </span>
            </div>
          </div>

          {/* Action Buttons (Active Game) */}
          {!isGameOver && !isCancelledOrRefunded && (
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setShowResignConfirm(true)}
                disabled={!canPlay}
                className="button-secondary !border-rose-500/25 !text-rose-200"
              >
                Đầu hàng
              </button>

              <button
                onClick={() => setShowDrawOfferModal(true)}
                disabled={!canPlay}
                className="button-secondary"
              >
                Đề nghị hòa
              </button>
            </div>
          )}

          {/* Cancelled / Refunded / Aborted Room Section */}
          {isCancelledOrRefunded && (
            <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-4 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <span>🚫</span>
                <span>Phòng đã hủy/hoàn tiền</span>
              </div>

              <p className="text-xs text-slate-300">
                Phòng này đã ở trạng thái{" "}
                {ROOM_STATUS_TEXT[room!.status]?.label ?? "hủy/hoàn tiền"}. Tiền
                cược đã được hoàn về số dư khả dụng (pending) của người chơi.
              </p>

              {/* Withdrawal info when cancelled/refunded */}
              <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Số dư khả dụng (pending):
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatEther(pendingBalance)} {CURRENCY_SYMBOL}
                  </span>
                </div>
                {pendingBalance > BigInt(0) && (
                  <button
                    onClick={() => withdraw()}
                    disabled={isWithdrawing}
                    className="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs shadow transition-all disabled:opacity-50"
                  >
                    {isWithdrawing
                      ? "Đang rút tiền..."
                      : "Rút tiền về ví (Withdraw)"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Game Over & Submit Result Section */}
          {isGameOver && (
            <div className="rounded-xl border border-amber-500/40 bg-gradient-to-br from-slate-900 to-amber-950/40 p-4 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <span>🏆</span>
                <span>Ván Đã Kết Thúc</span>
              </div>

              <p className="text-xs text-slate-300">
                {relaySession.resultProposal
                  ? outcomeMessage
                  : "Ván đấu đã hoàn thành. Hãy xác nhận và nộp kết quả 2-of-3 lên hợp đồng."}
              </p>

              {/* Submit Result Action */}
              {room?.status === 2 ? (
                <p className="text-xs font-semibold text-emerald-300">
                  Đã được nộp — kết quả đã xác nhận trên blockchain.
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
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs shadow-lg transition-all disabled:opacity-50"
                  >
                    {room?.status === 2 ||
                    submitResultHook.statusMessage === "Đã được nộp"
                      ? "Đã được nộp"
                      : submitResultHook.isSubmitting
                        ? "Đang xác thực & nộp..."
                        : "Ký & Nộp kết quả (2-trong-3)"}
                  </button>

                  {submitResultHook.needsNewProposal && (
                    <button
                      onClick={relaySession.requestResult}
                      className="w-full py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold"
                    >
                      Xin chữ ký mới từ Relay (request_result)
                    </button>
                  )}
                </div>
              ) : (
                <button
                  onClick={relaySession.requestResult}
                  disabled={!canSettle || !relaySession.isConnected}
                  className="w-full py-2 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-xs border border-amber-500/40"
                >
                  Lấy chữ ký kết quả từ Relay
                </button>
              )}

              {submitResultHook.error && (
                <div className="rounded-lg bg-rose-500/20 border border-rose-500/40 p-2 text-rose-300 text-xs">
                  ⚠️ {submitResultHook.error}
                </div>
              )}

              {/* Withdrawal info when settled */}
              <div className="border-t border-white/10 pt-3 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">
                    Số dư khả dụng (pending):
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {formatEther(pendingBalance)} {CURRENCY_SYMBOL}
                  </span>
                </div>
                {pendingBalance > BigInt(0) && (
                  <button
                    onClick={() => withdraw()}
                    disabled={isWithdrawing}
                    className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow"
                  >
                    {isWithdrawing
                      ? "Đang rút..."
                      : "Rút tiền về ví (Withdraw)"}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Moves List History */}
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 flex-1 flex flex-col min-h-[160px] max-h-[260px] overflow-hidden">
            <span className="text-xs font-bold text-slate-300 mb-2">
              Lịch Sử Nước Đi ({relaySession.moves.length})
            </span>
            <div className="flex-1 overflow-y-auto font-mono text-xs text-slate-400 space-y-1 pr-1">
              {sans.map((m, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-0.5 border-b border-white/5"
                >
                  <span className="text-slate-500">#{i + 1}</span>
                  <span className="text-slate-200">{m}</span>
                </div>
              ))}
              {relaySession.moves.length === 0 && (
                <div className="text-slate-600 text-center py-6">
                  Chưa có nước đi nào
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
          <div className="rounded-2xl border border-rose-500/40 bg-slate-900 p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 id="resign-title" className="text-base font-bold text-rose-300">
              Xác nhận đầu hàng
            </h3>
            <p className="text-xs text-slate-300">
              Bạn có chắc chắn muốn đầu hàng ván đấu này không? Đối thủ sẽ được
              công nhận chiến thắng. Tiền thắng bằng 95% tổng cược sau khi nộp
              kết quả thành công; phí mạng tính riêng.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowResignConfirm(false)}
                className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => {
                  setShowResignConfirm(false);
                  relaySession.sendResign();
                }}
                className="py-1.5 px-3 rounded-lg bg-rose-600 text-white text-xs font-bold"
              >
                Đồng ý đầu hàng
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
          <div className="rounded-2xl border border-white/10 bg-slate-900 p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <h3 id="draw-title" className="text-base font-bold text-slate-100">
              Gửi đề nghị hòa
            </h3>
            <p className="text-xs text-slate-300">
              Bạn có muốn gửi lời mời hòa cờ tới đối thủ không? Nếu đối thủ chấp
              nhận, ván đấu sẽ kết thúc hòa và tiền cược được hoàn lại cho cả
              hai người.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setShowDrawOfferModal(false)}
                className="py-1.5 px-3 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold"
              >
                Đóng
              </button>
              <button
                onClick={() => {
                  setShowDrawOfferModal(false);
                  relaySession.sendDrawOffer();
                }}
                className="py-1.5 px-3 rounded-lg bg-amber-500 text-slate-950 text-xs font-bold"
              >
                Gửi đề nghị hòa
              </button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}

export default function GamePage() {
  return (
    <div className="app-shell game-shell">
      <FujiTestnetBanner />
      <AppHeader />

      <main className="site-container flex-1 min-h-0 flex justify-center py-6">
        <Suspense
          fallback={
            <div className="text-sm text-slate-400 animate-pulse">
              Đang tải thông tin ván đấu...
            </div>
          }
        >
          <GameContent />
        </Suspense>
      </main>
    </div>
  );
}
