"use client";

import { useState, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import type { GameOutcome, EndReason, PlayerColor } from "@avaclash/shared";
import type { ChessScene } from "@/game/ChessScene";

// Dynamic import — no SSR for Phaser
const PhaserGame = dynamic(() => import("@/components/PhaserGame"), {
  ssr: false,
  loading: () => (
    <div className="w-[600px] h-[640px] bg-gray-900 rounded-xl flex items-center justify-center">
      <span className="text-white animate-pulse text-lg">Initializing chess engine...</span>
    </div>
  ),
});

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getOutcomeMessage(outcome: GameOutcome, reason: EndReason): string {
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

export default function GamePage() {
  const [moves, setMoves] = useState<{ san: string; uci: string }[]>([]);
  const [whiteMs, setWhiteMs] = useState(5 * 60 * 1000);
  const [blackMs, setBlackMs] = useState(5 * 60 * 1000);
  const [currentTurn, setCurrentTurn] = useState<PlayerColor>("white");
  const [gameResult, setGameResult] = useState<{ outcome: GameOutcome; reason: EndReason } | null>(null);
  const [showDrawConfirm, setShowDrawConfirm] = useState(false);
  const sceneRef = useRef<ChessScene | null>(null);
  const movesEndRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((uci: string, san: string) => {
    setMoves((prev) => [...prev, { san, uci }]);
    setTimeout(() => movesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, []);

  const handleGameOver = useCallback((outcome: GameOutcome, reason: EndReason) => {
    setGameResult({ outcome, reason });
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

  // Render move pairs (1. e4 e5  2. Nf3 Nc6 ...)
  const movePairs: { num: number; white: string; black?: string }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push({
      num: Math.floor(i / 2) + 1,
      white: moves[i]!.san,
      black: moves[i + 1]?.san,
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 flex flex-col items-center justify-center p-4 gap-6">
      {/* Title */}
      <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 tracking-tight">
        ♚ AvaClash Chess
      </h1>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Board + Clocks */}
        <div className="flex flex-col gap-3">
          {/* Black clock (top) */}
          <div
            className={`flex items-center justify-between px-4 py-2 rounded-lg transition-all ${
              currentTurn === "black" && !gameResult
                ? "bg-gray-800 ring-2 ring-amber-400 shadow-lg shadow-amber-400/20"
                : "bg-gray-800/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">♟</span>
              <span className="text-gray-300 font-medium">Black</span>
            </div>
            <span className={`text-2xl font-mono font-bold ${blackMs < 30000 ? "text-red-400" : "text-white"}`}>
              {formatTime(blackMs)}
            </span>
          </div>

          {/* Phaser Board */}
          <PhaserGame
            boardSize={560}
            flipBoard={false}
            onMove={handleMove}
            onGameOver={handleGameOver}
            onClockTick={handleClockTick}
            onTurnChange={handleTurnChange}
            onSceneReady={handleSceneReady}
          />

          {/* White clock (bottom) */}
          <div
            className={`flex items-center justify-between px-4 py-2 rounded-lg transition-all ${
              currentTurn === "white" && !gameResult
                ? "bg-gray-800 ring-2 ring-amber-400 shadow-lg shadow-amber-400/20"
                : "bg-gray-800/50"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">♙</span>
              <span className="text-gray-300 font-medium">White</span>
            </div>
            <span className={`text-2xl font-mono font-bold ${whiteMs < 30000 ? "text-red-400" : "text-white"}`}>
              {formatTime(whiteMs)}
            </span>
          </div>
        </div>

        {/* Side Panel */}
        <div className="w-72 flex flex-col gap-4">
          {/* Game Result Banner */}
          {gameResult && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-amber-600/20 to-orange-600/20 border border-amber-500/30 backdrop-blur">
              <p className="text-lg font-bold text-amber-300 text-center">
                {getOutcomeMessage(gameResult.outcome, gameResult.reason)}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold transition-colors"
              >
                New Game
              </button>
            </div>
          )}

          {/* Move List */}
          <div className="bg-gray-800/60 rounded-xl border border-gray-700/50 backdrop-blur">
            <h2 className="px-4 py-2 text-sm font-semibold text-gray-400 border-b border-gray-700/50 uppercase tracking-wider">
              Moves
            </h2>
            <div className="h-64 overflow-y-auto p-2 scrollbar-thin">
              {movePairs.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Game starts — White to move</p>
              ) : (
                <div className="space-y-0.5">
                  {movePairs.map((pair) => (
                    <div key={pair.num} className="flex text-sm font-mono">
                      <span className="w-8 text-gray-500 text-right mr-2">{pair.num}.</span>
                      <span className="w-20 text-white">{pair.white}</span>
                      <span className="w-20 text-gray-300">{pair.black ?? ""}</span>
                    </div>
                  ))}
                </div>
              )}
              <div ref={movesEndRef} />
            </div>
          </div>

          {/* Action Buttons */}
          {!gameResult && (
            <div className="flex gap-3">
              <button
                onClick={handleResign}
                className="flex-1 py-2.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 hover:text-red-300 font-medium border border-red-600/30 transition-all"
              >
                🏳 Resign
              </button>
              <button
                onClick={handleDrawOffer}
                className="flex-1 py-2.5 rounded-lg bg-gray-600/20 hover:bg-gray-600/40 text-gray-300 hover:text-white font-medium border border-gray-600/30 transition-all"
              >
                ½ Draw
              </button>
            </div>
          )}

          {/* Draw Confirmation */}
          {showDrawConfirm && !gameResult && (
            <div className="p-4 rounded-xl bg-gray-800 border border-gray-600">
              <p className="text-gray-300 text-sm mb-3">Both players agree to a draw?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDrawAccept}
                  className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-medium transition-colors"
                >
                  Yes, Draw
                </button>
                <button
                  onClick={() => setShowDrawConfirm(false)}
                  className="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 font-medium transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Turn Indicator */}
          {!gameResult && (
            <div className="text-center py-2">
              <span className="text-gray-400 text-sm">
                {currentTurn === "white" ? "♙" : "♟"} {currentTurn === "white" ? "White" : "Black"} to move
              </span>
            </div>
          )}

          {/* Info */}
          <div className="text-xs text-gray-600 text-center">
            Hot-seat mode • 5+0 • Click to select, click to move
          </div>
        </div>
      </div>
    </div>
  );
}
