"use client";

import { CHAIN_ID } from "@/config/env";

export default function FujiTestnetBanner() {
  const isAnvil = CHAIN_ID === 31337;

  return (
    <aside
      aria-label="Cảnh báo môi trường thử nghiệm"
      className="w-full bg-[#17202d] text-slate-400 text-[11px] py-2 px-4 text-center flex items-center justify-center gap-2 border-b border-white/5"
    >
      <span
        className="h-1.5 w-1.5 rounded-full bg-amber-300/70"
        aria-hidden="true"
      />
      <span>
        {isAnvil
          ? "Anvil local - mạng thử nghiệm cục bộ"
          : "Fuji testnet - tiền thử nghiệm"}
      </span>
      <span className="hidden md:inline text-slate-500">
        {isAnvil
          ? " — Chain ID 31337 · Chỉ dùng tiền thử nghiệm."
          : " — Chỉ sử dụng mạng Avalanche Fuji Testnet (tiền thử nghiệm, không có giá trị quy đổi tài chính thật)."}
      </span>
    </aside>
  );
}
