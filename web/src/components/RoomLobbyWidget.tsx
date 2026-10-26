"use client";

import { useState } from "react";
import Link from "next/link";

export default function RoomLobbyWidget() {
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create Room State
  const [stake, setStake] = useState<string>("0.01");
  const [creatorIsWhite, setCreatorIsWhite] = useState<boolean>(true);
  const [createdRoomId, setCreatedRoomId] = useState<number | null>(null);

  // Join Room State
  const [joinRoomId, setJoinRoomId] = useState<string>("101");
  // Simulated room query result for preview before staking
  const [mockRoomLookup, setMockRoomLookup] = useState<{
    id: number;
    creatorIsWhite: boolean;
    stake: string;
  } | null>({
    id: 101,
    creatorIsWhite: true,
    stake: "0.01",
  });

  const handleLookup = (idStr: string) => {
    setJoinRoomId(idStr);
    const parsedId = parseInt(idStr, 10);
    if (!isNaN(parsedId) && parsedId > 0) {
      // For preview: odd room IDs creator is white, even is black (or default true)
      setMockRoomLookup({
        id: parsedId,
        creatorIsWhite: parsedId % 2 !== 0,
        stake: "0.01",
      });
    } else {
      setMockRoomLookup(null);
    }
  };

  const handleCreate = () => {
    const randomId = Math.floor(100 + Math.random() * 900);
    setCreatedRoomId(randomId);
  };

  return (
    <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-slate-900/90 backdrop-blur-xl p-6 shadow-2xl flex flex-col gap-5 text-left text-slate-100 animate-fade-in">
      {/* Tab Switcher */}
      <div className="flex rounded-xl border border-white/10 bg-slate-950/80 p-1">
        <button
          type="button"
          onClick={() => {
            setTab("create");
            setCreatedRoomId(null);
          }}
          className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
            tab === "create"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          ⚔️ Create Wager Room
        </button>
        <button
          type="button"
          onClick={() => setTab("join")}
          className={`flex-1 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all ${
            tab === "join"
              ? "bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 shadow-md"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          🚪 Enter Existing Room
        </button>
      </div>

      {tab === "create" ? (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Choose Your Color (Stored On-Chain via Q13)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setCreatorIsWhite(true)}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                  creatorIsWhite
                    ? "bg-amber-100 text-slate-950 border-amber-400 ring-2 ring-amber-400/50 shadow-lg"
                    : "bg-slate-950 text-slate-300 border-white/10 hover:border-white/30"
                }`}
              >
                <span className="text-xl">♔</span>
                <span>White (First Move)</span>
              </button>
              <button
                type="button"
                onClick={() => setCreatorIsWhite(false)}
                className={`flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl border font-bold text-sm transition-all ${
                  !creatorIsWhite
                    ? "bg-slate-800 text-amber-300 border-amber-400 ring-2 ring-amber-400/50 shadow-lg"
                    : "bg-slate-950 text-slate-300 border-white/10 hover:border-white/30"
                }`}
              >
                <span className="text-xl">♚</span>
                <span>Black (Second Move)</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Stake Amount (Min 0.01 AVAX • Q14)
            </label>
            <div className="flex gap-2">
              {["0.01", "0.05", "0.1", "0.5"].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStake(val)}
                  className={`flex-1 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
                    stake === val
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/50"
                      : "bg-slate-950 text-slate-400 border-white/10 hover:border-white/20"
                  }`}
                >
                  {val} AVAX
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="number"
                min="0.01"
                max="1.0"
                step="0.01"
                value={stake}
                onChange={(e) => setStake(e.target.value)}
                className="w-full rounded-lg bg-slate-950 border border-white/10 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                placeholder="Custom stake in AVAX"
              />
              <span className="text-xs font-bold text-slate-400 shrink-0">AVAX</span>
            </div>
          </div>

          {/* On-Chain Color Parameters Card */}
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3.5 flex flex-col gap-2 text-xs text-slate-300">
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Your Color (Creator):</span>
              <span className="font-bold text-amber-300">
                {creatorIsWhite ? "White (Plays 1st)" : "Black (Plays 2nd)"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Opponent Assigned Color:</span>
              <span className="font-semibold text-slate-200">
                {creatorIsWhite ? "Black (Assigned via chain)" : "White (Assigned via chain)"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-400">Dispute Bond (Q11):</span>
              <span className="font-mono text-slate-300">
                {Math.max(0.01, parseFloat(stake || "0") * 0.2).toFixed(4)} AVAX
              </span>
            </div>
          </div>

          {!createdRoomId ? (
            <button
              type="button"
              onClick={handleCreate}
              className="mt-1 w-full py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold text-sm shadow-lg shadow-orange-500/25 transition-all hover:scale-[1.01] active:scale-95"
            >
              Create Room #{Math.floor(100 + Math.random() * 900)} ({creatorIsWhite ? "White" : "Black"})
            </button>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex flex-col gap-2">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <span>✓</span>
                <span>Room #{createdRoomId} Initialized!</span>
              </div>
              <p className="text-xs text-slate-300">
                You created this room as <strong>{creatorIsWhite ? "White" : "Black"}</strong>.
                The opponent joining will automatically be assigned{" "}
                <strong>{creatorIsWhite ? "Black" : "White"}</strong>.
              </p>
              <Link
                href={`/game?roomId=${createdRoomId}&color=${creatorIsWhite ? "white" : "black"}`}
                className="mt-2 text-center py-2.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs shadow hover:bg-emerald-400"
              >
                Enter Match #{createdRoomId} →
              </Link>
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Room ID to Join
            </label>
            <input
              type="number"
              value={joinRoomId}
              onChange={(e) => handleLookup(e.target.value)}
              className="w-full rounded-lg bg-slate-950 border border-white/10 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-rose-400"
              placeholder="e.g. 101"
            />
          </div>

          {mockRoomLookup ? (
            <div className="rounded-xl border border-rose-500/30 bg-slate-950/80 p-4 flex flex-col gap-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Match Stake:</span>
                <span className="font-mono font-bold text-slate-200">
                  {mockRoomLookup.stake} AVAX
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Room Creator Color:</span>
                <span className="font-semibold text-slate-300">
                  {mockRoomLookup.creatorIsWhite ? "White" : "Black"}
                </span>
              </div>
              <div className="mt-1 pt-2 border-t border-white/10 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300">Your Assigned Color:</span>
                <span
                  className={`px-2.5 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider ${
                    !mockRoomLookup.creatorIsWhite
                      ? "bg-amber-100 text-slate-950 ring-1 ring-amber-400"
                      : "bg-slate-800 text-amber-300 ring-1 ring-slate-600"
                  }`}
                >
                  {!mockRoomLookup.creatorIsWhite ? "♔ WHITE (Plays 1st)" : "♚ BLACK (Plays 2nd)"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 italic">
                * Colors are fixed on-chain. You see your assigned color before staking.
              </p>

              <Link
                href={`/game?roomId=${mockRoomLookup.id}&color=${!mockRoomLookup.creatorIsWhite ? "white" : "black"}`}
                className="mt-2 text-center py-3 rounded-xl bg-gradient-to-r from-rose-500 to-orange-500 text-slate-950 font-bold text-sm shadow-lg shadow-rose-500/25 transition-all hover:scale-[1.01] active:scale-95"
              >
                Stake {mockRoomLookup.stake} AVAX & Play as {!mockRoomLookup.creatorIsWhite ? "White" : "Black"} →
              </Link>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4 text-center text-xs text-slate-400">
              Enter a valid Room ID to inspect parameters before staking.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
