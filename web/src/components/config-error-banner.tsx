"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useContractBytecodeGuard } from "@/hooks/use-contract-bytecode-guard";

export default function ConfigErrorBanner() {
  const uiText = useUiCopy();
  const { hasConfigError, errorMessage } = useContractBytecodeGuard();

  if (!hasConfigError || !errorMessage) return null;

  return (
    <aside
      role="alert"
      className="w-full bg-status-danger text-background font-bold text-xs sm:text-sm py-3 px-4 text-center shadow-lg border-b border-status-danger z-50 sticky top-0 animate-fade-in"
    >
      <div className="max-w-4xl mx-auto flex items-center justify-center gap-2">
        <span className="text-xl">🛑</span>
        <span>
          <strong>{uiText("messageSmartContractConfigurationError")}</strong>{" "}
          {uiText.existing(errorMessage)}
        </span>
      </div>
    </aside>
  );
}
