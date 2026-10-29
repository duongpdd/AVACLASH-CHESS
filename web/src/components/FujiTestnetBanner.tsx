"use client";

import { CHAIN_ID } from "@/config/env";

export default function FujiTestnetBanner() {
  const isAnvil = CHAIN_ID === 31337;

  return (
    <aside
      aria-label="Cảnh báo môi trường thử nghiệm"
      className="w-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-slate-950 font-extrabold text-xs sm:text-sm py-2 px-4 text-center shadow-lg flex items-center justify-center gap-2 border-b border-amber-300/40 select-none z-50 sticky top-0"
    >
      <span className="text-base animate-pulse">⚠️</span>
      <span>
        {isAnvil ? "Anvil local - mạng thử nghiệm cục bộ" : "Fuji testnet - tiền thử nghiệm"}
      </span>
      <span className="hidden md:inline font-medium text-slate-900">
        {isAnvil
          ? " — Đang kết nối nút Anvil cục bộ (Chain ID 31337, môi trường dev)."
          : " — Chỉ sử dụng mạng Avalanche Fuji Testnet (tiền thử nghiệm, không có giá trị quy đổi tài chính thật)."}
      </span>
    </aside>
  );
}
