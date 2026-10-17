import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-indigo-950 flex flex-col items-center justify-center p-8">
      <div className="text-center max-w-lg">
        {/* Logo */}
        <div className="text-7xl mb-6">♚</div>

        <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500 mb-4">
          AvaClash Chess
        </h1>

        <p className="text-gray-400 text-lg mb-8 leading-relaxed">
          1v1 Chess with AVAX testnet wagering on Avalanche Fuji.
          <br />
          <span className="text-gray-500 text-sm">Play off-chain, settle on-chain.</span>
        </p>

        {/* Play Button */}
        <Link
          href="/game"
          className="inline-block px-10 py-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-black font-bold text-lg shadow-lg shadow-amber-500/25 hover:shadow-amber-400/40 transition-all transform hover:scale-105"
        >
          ♟ Play Hot-Seat
        </Link>

        <p className="mt-6 text-gray-600 text-xs">
          Phase 3 — Local hot-seat mode (two players, one screen)
        </p>

        {/* Features */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30">
            <div className="text-2xl mb-1">⏱</div>
            <div className="text-gray-400 text-xs">5+0 Clock</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30">
            <div className="text-2xl mb-1">✓</div>
            <div className="text-gray-400 text-xs">Full Rules</div>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700/30">
            <div className="text-2xl mb-1">🔗</div>
            <div className="text-gray-400 text-xs">On-Chain</div>
          </div>
        </div>
      </div>
    </div>
  );
}
