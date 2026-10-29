"use client";

import { useState, useCallback, useRef } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import type { GameOutcome, EndReason, PlayerColor } from "@avaclash/shared";
import type { ChessScene } from "@/game/ChessScene";
import type { CapturedPiece, MaterialStats } from "@/game/GameState";
import VictoryModal from "@/components/VictoryModal";
import SpectatorPoolWidget from "@/components/SpectatorPoolWidget";
import FujiTestnetBanner from "@/components/FujiTestnetBanner";
import WalletBar from "@/components/WalletBar";
import { useFairPlayGuard } from "@/hooks/useFairPlayGuard";

// Dynamic import — no SSR for Phaser
const PhaserGame = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
  loading: () => (
    <div className="w-[464px] h-[464px] bg-slate-950/80 rounded-lg flex items-center justify-center">
      <div className="flex items-center gap-2 text-slate-400 text-sm animate-pulse">
        <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
        Initializing chess engine...
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

function getOutcomeMessage(outcome: GameOutcome, reason: EndReason | string): string {
  if (outcome === "draw") {
    const reasonMap: Record<string, string> = {
      stalemate: "Stalemate",
      repetition: "Threefold Repetition",
      fifty: "Fifty-Move Rule",
      insufficient: "Insufficient Material",
      draw_agreed: "Draw Agreed",
    };
    return `Draw — ${reasonMap[reason] ?? reason}`;
  }
  const winner = outcome === "white" ? "White" : "Black";
  const reasonMap: Record<string, string> = {
    checkmate: "Checkmate",
    resign: "Resignation",
    timeout: "Time Out",
  };
  return `${winner} Wins — ${reasonMap[reason] ?? reason}`;
}

interface PlayerClockCardProps {
  name: string;
  color: "w" | "b";
  elo?: number;
  warnings?: number;
  timeFormatted: string;
  isActive: boolean;
  isLowTime?: boolean;
  capturedPieces?: CapturedPiece[];
  materialAdvantage?: number;
}

function PlayerClockCard({
  name,
  color,
  elo = 1200,
  warnings = 0,
  timeFormatted,
  isActive,
  isLowTime = false,
  capturedPieces = [],
  materialAdvantage = 0,
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
          {/* Icon đại diện phe Trắng / Đen */}
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
              {/* Huy hiệu On-Chain ELO */}
              <span className="inline-flex items-center rounded-md bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-bold font-mono text-amber-300 border border-amber-400/30 shadow-sm">
                {elo} ELO
              </span>
              {isActive && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-ping" />
                  Turn
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[11px] text-slate-400">
                {color === "w" ? "White Pieces" : "Black Pieces"}
              </span>
              {warnings > 0 && (
                <span className="text-[10px] font-semibold text-rose-400 bg-rose-500/15 border border-rose-500/30 px-1.5 py-0.2 rounded">
                  ⚠️ {warnings}/3 Violations
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Đồng hồ đếm ngược */}
        <div
          className={`rounded-lg px-3 py-1 font-mono text-lg font-bold tabular-nums tracking-tight transition-colors ${
            isActive
              ? isLowTime
                ? "bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/50 animate-pulse"
                : "bg-amber-400 text-slate-950 shadow-sm"
              : "bg-slate-950/60 text-slate-400"
          }`}
        >
          {timeFormatted}
        </div>
      </div>

      {/* Hiển thị quân đã bắt và lợi thế vật chất */}
      <div className="mt-1 flex items-center justify-between gap-2 text-xs min-h-[18px]">
        <div className="flex flex-wrap items-center gap-0.5" aria-label="Captured pieces">
          {capturedPieces.map((piece, index) => (
            <span
              key={`${piece.type}-${index}`}
              title={piece.type}
              className={`text-sm leading-none ${color === "w" ? "text-slate-400" : "text-amber-100"}`}
            >
              {piece.symbol}
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

export default function GamePage() {
  const [moves, setMoves] = useState<{ san: string; uci: string }[]>([]);
  const [whiteMs, setWhiteMs] = useState(5 * 60 * 1000);
  const [blackMs, setBlackMs] = useState(5 * 60 * 1000);
  const [currentTurn, setCurrentTurn] = useState<PlayerColor>("white");
  const [gameResult, setGameResult] = useState<{ outcome: GameOutcome; reason: EndReason | string } | null>(null);
  const [showDrawConfirm, setShowDrawConfirm] = useState(false);
  const [showVictoryModal, setShowVictoryModal] = useState(false);
  const [materialStats, setMaterialStats] = useState<MaterialStats>({
    white: { captured: [], advantage: 0 },
    black: { captured: [], advantage: 0 },
  });

  // Fair-play anti-cheat state
  const [whiteWarnings, setWhiteWarnings] = useState(0);
  const [blackWarnings, setBlackWarnings] = useState(0);
  const [fairPlayAlert, setFairPlayAlert] = useState(false);
  const [fairPlayNotice, setFairPlayNotice] = useState<{ text: string; type: "warning" | "forfeit" } | null>(null);

  const sceneRef = useRef<ChessScene | null>(null);
  const movesEndRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((uci: string, san: string) => {
    setMoves((prev) => [...prev, { san, uci }]);
    setTimeout(() => {
      movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      if (sceneRef.current) {
        setMaterialStats(sceneRef.current.getGameState().getMaterialStats());
      }
    }, 50);
  }, []);

  const handleGameOver = useCallback((outcome: GameOutcome, reason: EndReason | string) => {
    setGameResult({ outcome, reason });
    setShowVictoryModal(true);
    if (sceneRef.current) {
      setMaterialStats(sceneRef.current.getGameState().getMaterialStats());
    }
  }, []);

  const handleClockTick = useCallback((wMs: number, bMs: number) => {
    setWhiteMs(wMs);
    setBlackMs(bMs);
  }, []);

  const handleTurnChange = useCallback((turn: PlayerColor) => {
    setCurrentTurn(turn);
  }, []);

  const handleSceneReady = useCallback((scene: unknown) => {
    sceneRef.current = scene as ChessScene;
    if (sceneRef.current) {
      setMaterialStats(sceneRef.current.getGameState().getMaterialStats());
    }
  }, []);

  const handleResign = useCallback(() => {
    if (sceneRef.current && !gameResult) {
      sceneRef.current.resign(currentTurn);
    }
  }, [currentTurn, gameResult]);

  const handleDrawOffer = useCallback(() => {
    if (!gameResult) {
      setShowDrawConfirm(true);
    }
  }, [gameResult]);

  const handleDrawAccept = useCallback(() => {
    setShowDrawConfirm(false);
    if (sceneRef.current && !gameResult) {
      sceneRef.current.offerDraw();
    }
  }, [gameResult]);

  // Fair-Play Violation Handler
  const handleFairPlayViolation = useCallback((warningCount: number, awayMs: number) => {
    if (gameResult) return;
    const violator = currentTurn;
    const penaltyMs = 10000; // 10s penalty
    const awaySeconds = (awayMs / 1000).toFixed(1);

    // Penalize clock
    if (sceneRef.current) {
      sceneRef.current.deductTime(violator, penaltyMs);
    }

    if (violator === "white") {
      setWhiteWarnings((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          // 3rd violation: Forfeit by Fair-Play Violation
          if (sceneRef.current) {
            sceneRef.current.forfeit("white", "timeout");
          }
          setGameResult({ outcome: "black", reason: "Fair-Play Violation (3 Tab Switches)" });
          setShowVictoryModal(true);
          setFairPlayNotice({
            text: `🚨 White accumulated 3 fair-play violations: Technical Forfeit!`,
            type: "forfeit",
          });
        } else {
          setFairPlayNotice({
            text: `⚠️ Tab Switch Detected: White away for ${awaySeconds}s (-10s penalty applied, Violation ${next}/3)`,
            type: "warning",
          });
        }
        return next;
      });
    } else {
      setBlackWarnings((prev) => {
        const next = prev + 1;
        if (next >= 3) {
          // 3rd violation: Forfeit by Fair-Play Violation
          if (sceneRef.current) {
            sceneRef.current.forfeit("black", "timeout");
          }
          setGameResult({ outcome: "white", reason: "Fair-Play Violation (3 Tab Switches)" });
          setShowVictoryModal(true);
          setFairPlayNotice({
            text: `🚨 Black accumulated 3 fair-play violations: Technical Forfeit!`,
            type: "forfeit",
          });
        } else {
          setFairPlayNotice({
            text: `⚠️ Tab Switch Detected: Black away for ${awaySeconds}s (-10s penalty applied, Violation ${next}/3)`,
            type: "warning",
          });
        }
        return next;
      });
    }

    setFairPlayAlert(true);
    setTimeout(() => {
      setFairPlayAlert(false);
    }, 6000);
  }, [currentTurn, gameResult]);

  // Activate FairPlay Guard when game is ongoing
  useFairPlayGuard(!gameResult && moves.length > 0, handleFairPlayViolation);

  // Nhóm các nước đi thành cặp (1. e4 e5)
  const movePairs: { moveNumber: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      moveNumber: Math.floor(i / 2) + 1,
      white: moves[i]!.san,
      black: moves[i + 1]?.san,
    });
  }

  const isWhiteTurn = currentTurn === "white";
  const currentMoveNumber = Math.floor(moves.length / 2) + 1;

  return (
    <div className="h-dvh w-full overflow-hidden bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 text-slate-100 flex flex-col select-none">
      <FujiTestnetBanner />
      {/* Header */}
      <header className="h-14 shrink-0 border-b border-white/10 bg-slate-950/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between z-10 gap-2">
        <Link href="/" className="flex items-center gap-2.5 group">
          <span className="text-2xl text-amber-400 transition-transform group-hover:scale-110">
            ♚
          </span>
          <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-amber-300 to-orange-400 bg-clip-text text-transparent hidden sm:inline">
            AvaClash Chess
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <WalletBar />
        </div>
      </header>

      {/* Thông báo vi phạm Fair-Play nếu có */}
      {fairPlayNotice && (
        <div
          className={`shrink-0 px-4 py-2 text-center text-xs font-semibold flex items-center justify-center gap-3 transition-all ${
            fairPlayNotice.type === "forfeit"
              ? "bg-rose-600/90 text-white shadow-lg"
              : "bg-amber-500/20 border-b border-amber-500/40 text-amber-200"
          }`}
        >
          <span>{fairPlayNotice.text}</span>
          <button
            type="button"
            onClick={() => setFairPlayNotice(null)}
            className="text-slate-400 hover:text-white text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Khu vực bàn cờ & bảng điều khiển */}
      <main className="flex-1 min-h-0 flex items-center justify-center p-3 lg:p-4 overflow-y-auto lg:overflow-hidden">
        <div className="flex flex-col lg:flex-row items-center lg:items-stretch justify-center gap-5 max-w-5xl w-full">
          {/* Cột trái: đồng hồ Đen + bàn cờ Phaser + đồng hồ Trắng */}
          <div className="flex flex-col justify-between gap-2 w-full max-w-[480px] shrink-0">
            <PlayerClockCard
              name="Black Player"
              color="b"
              elo={1200}
              warnings={blackWarnings}
              timeFormatted={formatTime(blackMs)}
              isActive={!isWhiteTurn && !gameResult}
              isLowTime={blackMs < 30000}
              capturedPieces={materialStats.black.captured}
              materialAdvantage={materialStats.black.advantage}
            />

            {/* Khung chứa Phaser Canvas */}
            <div className="relative aspect-square w-full max-w-[480px] rounded-xl p-2 bg-slate-900/90 border border-white/15 shadow-2xl flex items-center justify-center overflow-hidden">
              <PhaserGame
                boardSize={464}
                flipBoard={false}
                onMove={handleMove}
                onGameOver={handleGameOver}
                onClockTick={handleClockTick}
                onTurnChange={handleTurnChange}
                onSceneReady={handleSceneReady}
              />
            </div>

            <PlayerClockCard
              name="White Player"
              color="w"
              elo={1200}
              warnings={whiteWarnings}
              timeFormatted={formatTime(whiteMs)}
              isActive={isWhiteTurn && !gameResult}
              isLowTime={whiteMs < 30000}
              capturedPieces={materialStats.white.captured}
              materialAdvantage={materialStats.white.advantage}
            />
          </div>

          {/* Cột phải: trạng thái, lịch sử nước đi, widget Spectator Pool và nút thao tác */}
          <aside className="w-full max-w-[480px] lg:w-84 flex flex-col justify-between rounded-2xl border border-white/10 bg-slate-900/75 backdrop-blur-xl p-4 shadow-2xl h-full max-h-[640px] overflow-y-auto custom-scrollbar">
            {/* Banner trạng thái / kết quả */}
            {gameResult ? (
              <div className="mb-3 p-3 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 text-center animate-fade-in">
                <p className="text-base font-bold text-amber-300">
                  {getOutcomeMessage(gameResult.outcome, gameResult.reason)}
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => setShowVictoryModal(true)}
                    className="flex-1 py-1.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-200 text-xs font-bold border border-amber-400/30 transition-all active:scale-[0.98]"
                  >
                    View Trophy
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex-1 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-md active:scale-[0.98]"
                  >
                    Play Again
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-2.5 flex items-center justify-between rounded-xl bg-slate-800/80 border border-white/10 px-3.5 py-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`h-3 w-3 rounded-full transition-all ${
                      isWhiteTurn
                        ? "bg-white shadow-[0_0_8px_#fff]"
                        : "bg-slate-950 border border-slate-400 shadow-[0_0_8px_rgba(0,0,0,0.8)]"
                    }`}
                  />
                  <span className="text-sm font-bold text-slate-100">
                    {isWhiteTurn ? "White to move" : "Black to move"}
                  </span>
                </div>
                <span className="text-[11px] font-medium text-amber-400">
                  In Progress
                </span>
              </div>
            )}

            {/* Bảng lịch sử nước đi (SAN) với custom scrollbar */}
            <div className="flex-1 min-h-[140px] max-h-[180px] flex flex-col rounded-xl border border-white/10 bg-slate-950/60 overflow-hidden mb-2.5">
              <div className="grid grid-cols-7 border-b border-white/10 bg-slate-900/90 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <span className="col-span-1">#</span>
                <span className="col-span-3">White</span>
                <span className="col-span-3">Black</span>
              </div>

              <div className="flex-1 overflow-y-auto divide-y divide-white/5 text-sm font-mono custom-scrollbar">
                {movePairs.length === 0 ? (
                  <div className="h-full min-h-[100px] flex flex-col items-center justify-center text-slate-500 p-4 text-center font-sans">
                    <span className="text-xl mb-1 opacity-50">♟</span>
                    <p className="text-xs">No moves yet. Click a white piece to start!</p>
                  </div>
                ) : (
                  movePairs.map((pair, idx) => (
                    <div
                      key={pair.moveNumber}
                      className={`grid grid-cols-7 px-3 py-1 items-center ${
                        idx % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]"
                      }`}
                    >
                      <span className="col-span-1 text-xs text-slate-500">
                        {pair.moveNumber}.
                      </span>
                      <span className="col-span-3 font-medium text-slate-200">
                        {pair.white}
                      </span>
                      <span className="col-span-3 font-medium text-slate-400">
                        {pair.black ?? ""}
                      </span>
                    </div>
                  ))
                )}
                <div ref={movesEndRef} />
              </div>
            </div>

            {/* Widget Spectator Prediction Pool */}
            <div className="mb-2.5">
              <SpectatorPoolWidget currentMoveNumber={currentMoveNumber} isMatchActive={moves.length > 0} />
            </div>

            {/* Hộp thoại xác nhận hòa */}
            {showDrawConfirm && !gameResult && (
              <div className="mb-2 p-2.5 rounded-xl bg-slate-800 border border-slate-600 animate-fade-in">
                <p className="text-slate-200 text-xs font-medium mb-2 text-center">
                  Both players agree to a draw?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDrawAccept}
                    className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors"
                  >
                    Yes, Draw
                  </button>
                  <button
                    onClick={() => setShowDrawConfirm(false)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Cụm nút điều khiển */}
            {!gameResult && !showDrawConfirm && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleResign}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/15 hover:bg-rose-500/25 active:scale-[0.98] px-3 py-1.5 text-xs font-semibold text-rose-300 transition"
                  >
                    <span>🏳️</span>
                    <span>Resign</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDrawOffer}
                    className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-600/50 bg-slate-800/80 hover:bg-slate-700/80 active:scale-[0.98] px-3 py-1.5 text-xs font-semibold text-slate-200 transition"
                  >
                    <span>½</span>
                    <span>Offer Draw</span>
                  </button>
                </div>

                <p className="text-center text-[10px] text-slate-500">
                  Click a piece to see legal moves • Alt+Tab &gt;2s deducts 10s
                </p>
              </div>
            )}
          </aside>
        </div>
      </main>

      {/* Victory / Game Over Modal */}
      <VictoryModal
        open={showVictoryModal}
        winner={
          gameResult?.outcome === "white"
            ? "White Player"
            : gameResult?.outcome === "black"
            ? "Black Player"
            : "Draw"
        }
        method={
          gameResult?.reason === "checkmate"
            ? "checkmate"
            : gameResult?.reason === "resign"
            ? "resignation"
            : gameResult?.reason === "timeout"
            ? "time out"
            : gameResult?.reason === "stalemate"
            ? "stalemate"
            : gameResult?.reason === "repetition"
            ? "threefold repetition"
            : gameResult?.reason === "fifty"
            ? "fifty-move rule"
            : gameResult?.reason === "insufficient"
            ? "insufficient material"
            : gameResult?.reason === "draw_agreed"
            ? "mutual agreement"
            : gameResult?.reason ?? ""
        }
        movesCount={Math.ceil(moves.length / 2)}
        timeRemaining={
          gameResult?.outcome === "white"
            ? formatTime(whiteMs)
            : gameResult?.outcome === "black"
            ? formatTime(blackMs)
            : formatTime(isWhiteTurn ? whiteMs : blackMs)
        }
        avaxWager="Hot-Seat"
        transactionStatus="not-started"
        onPlayAgain={() => window.location.reload()}
        onClose={() => setShowVictoryModal(false)}
      />
    </div>
  );
}
