"use client";

import { useContractBytecodeGuard } from "@/hooks/useContractBytecodeGuard";

export default function ConfigErrorBanner() {
  const { hasConfigError, errorMessage } = useContractBytecodeGuard();

  if (!hasConfigError || !errorMessage) return null;

  return (
    <aside
      role="alert"
      className="w-full bg-rose-600 text-white font-bold text-xs sm:text-sm py-3 px-4 text-center shadow-lg border-b border-rose-400 z-50 sticky top-0 animate-fade-in"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
        <span className="text-xl">🛑</span>
        <span>
          <strong>LỖI CẤU HÌNH SMART CONTRACT:</strong> {errorMessage}
        </span>
      </div>
    </aside>
  );
}

