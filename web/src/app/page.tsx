"use client";

import { useState } from "react";
import Link from "next/link";
import RoomLobbyWidget from "@/components/RoomLobbyWidget";

export default function HomePage() {
  const [selectedTab, setSelectedTab] = useState<"hotseat" | "noloss" | "wager">("hotseat");

  return (
    <main className="relative min-h-dvh w-full overflow-x-hidden bg-gray-950 text-slate-100 flex flex-col items-center justify-between px-4 py-8 select-none">
      {/* Hiệu ứng ánh sáng nền Ambient Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full bg-amber-500/15 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-10 right-10 h-96 w-96 rounded-full bg-indigo-600/15 blur-[140px]" />
      <div className="pointer-events-none absolute top-1/3 -left-20 h-80 w-80 rounded-full bg-rose-600/10 blur-[130px]" />

      {/* Top Navbar */}
      <header className="relative z-10 max-w-6xl w-full flex items-center justify-between py-2 border-b border-white/10 mb-6">
        <div className="flex items-center gap-2.5">
          <span className="text-3xl text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.4)]">
            ♚
          </span>
          <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400 bg-clip-text text-transparent">
            AvaClash Chess
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Avalanche Fuji Testnet</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-slate-900/80 px-3 py-1 text-xs font-bold font-mono text-amber-300">
            <span>Reputation:</span>
            <span>1200 ELO</span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center">
        {/* Architecture Badge */}
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs font-semibold text-amber-300 shadow-sm backdrop-blur-md">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          <span>Pure FIDE Core + Web3 Meta Layer Architecture</span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-tight bg-gradient-to-r from-amber-200 via-orange-300 to-rose-400 bg-clip-text text-transparent pb-2">
          Pure FIDE Chess.
          <br />
          Decentralized Meta Economy.
        </h1>

        <p className="mt-3 text-base sm:text-lg text-slate-300 max-w-2xl font-medium">
          Zero board modifications. 100% standard FIDE 5+0 Blitz.
          Engine-guarded with Client Focus Telemetry, No-Loss Season Vaults, and Spectator Parimutuel Pools on Avalanche.
        </p>

        {/* Financial Mode Selection Tabs */}
        <div className="mt-8 w-full max-w-xl flex rounded-xl border border-white/10 bg-slate-900/80 p-1.5 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setSelectedTab("hotseat")}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              selectedTab === "hotseat"
                ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ♟ Hot-Seat Blitz
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("noloss")}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              selectedTab === "noloss"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🛡️ No-Loss Arena
          </button>
          <button
            type="button"
            onClick={() => setSelectedTab("wager")}
            className={`flex-1 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all ${
              selectedTab === "wager"
                ? "bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            ⚔️ High-Stakes PvP
          </button>
        </div>

        {/* Selected Mode Showcase Card */}
        <div className="mt-6 w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-xl p-6 shadow-2xl flex flex-col items-center text-center">
          {selectedTab === "hotseat" && (
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <span className="text-3xl text-amber-400">⚡</span>
              <h3 className="text-lg font-bold text-slate-100">Local Hot-Seat 5+0 Blitz</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                Pass-and-play on a single device with active anti-cheat telemetry, spectator pool simulation, and standard FIDE rule validation.
              </p>
              <div className="mt-3 flex items-center gap-4 text-xs font-mono text-slate-300">
                <span className="rounded-md bg-white/5 px-2.5 py-1">⏱️ 5:00 Clock</span>
                <span className="rounded-md bg-white/5 px-2.5 py-1">🛡️ Anti-Alt-Tab Guard</span>
                <span className="rounded-md bg-white/5 px-2.5 py-1">🏆 1200 ELO Rating</span>
              </div>
              <Link
                href="/game"
                className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.02] hover:shadow-orange-500/40 active:scale-95"
              >
                <span>Play Hot-Seat Now</span>
                <span>→</span>
              </Link>
            </div>
          )}

          {selectedTab === "noloss" && (
            <div className="flex flex-col items-center gap-3 animate-fade-in">
              <span className="text-3xl text-emerald-400">🛡️</span>
              <h3 className="text-lg font-bold text-slate-100">No-Loss Tournament Vault</h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md">
                Stake min 0.5 AVAX to unlock weekly tournament qualification. 100% of principal is protected and withdrawable anytime. Weekly prize pool shared by top ELO.
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs font-mono text-emerald-300">
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">Prize Pool: 145.8 AVAX</span>
                <span className="rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">Staked: 1,280 AVAX</span>
              </div>
              <Link
                href="/game"
                className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-bold text-slate-950 shadow-lg shadow-emerald-500/25 transition-all hover:scale-[1.02] active:scale-95"
              >
                <span>Enter No-Loss Arena</span>
                <span>→</span>
              </Link>
            </div>
          )}

          {selectedTab === "wager" && (
            <RoomLobbyWidget />
          )}
        </div>

        {/* 4 Architectural Pillars Grid */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
          <div className="flex flex-col text-left rounded-xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-2">🏛️</span>
            <span className="text-sm font-bold text-slate-200">1. Core FIDE Layer</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Standard 64-square Blitz (5+0). Tested against 117 FIDE test suites.
            </p>
          </div>

          <div className="flex flex-col text-left rounded-xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-2">🛡️</span>
            <span className="text-sm font-bold text-slate-200">2. Anti-Cheat Guard</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Tab-switch &gt;2s deducts 10s. Over 3 violations triggers automatic technical forfeit.
            </p>
          </div>

          <div className="flex flex-col text-left rounded-xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-2">💎</span>
            <span className="text-sm font-bold text-slate-200">3. DeFi Staking Vault</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              AvaClashMeta.sol: 100% principal protection with yield and fee sharing.
            </p>
          </div>

          <div className="flex flex-col text-left rounded-xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-2">📊</span>
            <span className="text-sm font-bold text-slate-200">4. Spectator Prediction</span>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Parimutuel odds on White, Black, and Draw. Automatically locks when match starts.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 max-w-6xl w-full flex flex-col sm:flex-row items-center justify-between py-6 mt-12 border-t border-white/10 text-xs text-slate-500">
        <div>
          <span>AvaClash Chess • Avalanche Fuji Blitz Ecosystem</span>
        </div>
        <div className="flex items-center gap-4 mt-2 sm:mt-0">
          <span>Smart Contract: AvaClashMeta.sol</span>
          <span>•</span>
          <span>ChessEscrow.sol</span>
        </div>
      </footer>
    </main>
  );
}
