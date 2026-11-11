"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { useContractBytecodeGuard } from "@/hooks/use-contract-bytecode-guard";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";

export default function ConfigErrorBanner() {
  const uiText = useUiCopy();
  const t = useTranslations("statusDisplay");
  const { hasConfigError, errorMessage } = useContractBytecodeGuard();

  if (!hasConfigError || !errorMessage) return null;

  return (
    <aside role="alert" className="config-error-banner">
      <TriangleAlert size={20} aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold">{t("onlineUnavailable")}</p>
        <p className="mt-1">{t("onlineUnavailableDetail")}</p>
        <details className="mt-2">
          <summary>{t("technicalDetails")}</summary>
          <p className="mt-2">
            <strong>{uiText("messageSmartContractConfigurationError")}</strong>{" "}
            {uiText.existing(errorMessage)}
          </p>
        </details>
      </div>
    </aside>
  );
}
