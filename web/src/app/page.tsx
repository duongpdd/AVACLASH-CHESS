import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-dvh w-full overflow-hidden bg-gray-950 text-slate-100 flex flex-col items-center justify-center px-4 select-none">
      {/* Hiệu ứng ánh sáng nền Ambient Glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full bg-amber-500/15 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 right-10 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />

      <div className="relative z-10 max-w-2xl w-full flex flex-col items-center text-center">
        {/* Badge Phase 3 */}
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1 text-xs font-medium text-amber-300 shadow-sm">
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          Phase 3 — Local Hot-Seat Mode
        </div>

        {/* Icon Vương miện nổi bật */}
        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-b from-slate-800/80 to-slate-900/90 shadow-2xl shadow-amber-500/10">
          <span className="text-5xl text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.4)]">
            ♚
          </span>
        </div>

        {/* Tiêu đề chính */}
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 bg-clip-text text-transparent pb-2">
          AvaClash Chess
        </h1>

        {/* Mô tả phụ */}
        <p className="mt-3 text-base sm:text-lg text-slate-300 max-w-md font-medium">
          1v1 Chess with AVAX testnet wagering on Avalanche Fuji.
        </p>
        <p className="mt-1 text-sm text-slate-500">
          Play off-chain, settle on-chain.
        </p>

        {/* Nút CTA chính */}
        <div className="mt-8">
          <Link
            href="/game"
            className="group relative inline-flex items-center gap-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-8 py-4 text-lg font-bold text-slate-950 shadow-lg shadow-orange-500/25 transition-all duration-200 hover:scale-[1.03] hover:from-amber-400 hover:to-orange-500 hover:shadow-orange-500/40 active:scale-[0.99]"
          >
            <span className="text-xl transition-transform group-hover:-rotate-12">♟</span>
            <span>Play Hot-Seat</span>
          </Link>
        </div>

        {/* 3 Thẻ tính năng */}
        <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-lg">
          <div className="flex flex-col items-center rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-1.5">⏱️</span>
            <span className="text-sm font-semibold text-slate-200">5+0 Blitz Clock</span>
            <span className="text-xs text-slate-400 mt-0.5">Fast-paced matches</span>
          </div>

          <div className="flex flex-col items-center rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-1.5">⚖️</span>
            <span className="text-sm font-semibold text-slate-200">Full FIDE Rules</span>
            <span className="text-xs text-slate-400 mt-0.5">Powered by chess.js</span>
          </div>

          <div className="flex flex-col items-center rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md p-4 transition hover:border-amber-500/40">
            <span className="text-2xl mb-1.5">⛓️</span>
            <span className="text-sm font-semibold text-slate-200">On-Chain Ready</span>
            <span className="text-xs text-slate-400 mt-0.5">Avalanche Fuji Testnet</span>
          </div>
        </div>
      </div>
    </main>
  );
}
