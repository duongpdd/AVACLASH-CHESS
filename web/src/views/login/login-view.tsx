"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ProviderNotFoundError, useAccount, useConnect } from "wagmi";
import { NETWORK_NAME } from "@/config/env";
import { useAuth } from "@/providers/auth-provider";
import { useTranslations } from "next-intl";
import { workspaceReturn } from "@/utils/workspace-return";
import Icon from "@/components/app-icon";
import AppHeader from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { CardCustom } from "@/components/ui/card-custom";
import { PageHeader } from "@/components/ui/page-header";

function WalletSetupHelp() {
  const t = useTranslations("login");
  const [copyStatus, setCopyStatus] = useState("");

  async function copyPageLink() {
    try {
      const next = workspaceReturn(
        new URL(window.location.href).searchParams.get("next"),
      );
      await navigator.clipboard.writeText(
        new URL(next, window.location.origin).href,
      );
      setCopyStatus(t("copied"));
    } catch {
      setCopyStatus(t("manualCopy"));
    }
  }

  return (
    <div className="grid w-full gap-3 rounded-lg border border-status-danger/25 p-3 text-left">
      <p role="alert" className="text-sm font-semibold text-status-danger">
        {t("walletMissing")}
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          className="button-secondary"
          href="https://metamask.com/download"
          target="_blank"
          rel="noreferrer"
        >
          {t("getMetaMask")}
        </a>
        <a
          className="button-secondary"
          href="https://support.core.app/en/articles/6066879-core-extension-how-do-i-add-the-core-extension"
          target="_blank"
          rel="noreferrer"
        >
          {t("getCore")}
        </a>
      </div>
      <p className="helper-text">{t("mobileWallet")}</p>
      <Button
        type="button"
        className="w-fit"
        onClick={() => void copyPageLink()}
      >
        <Icon name="copy" />
        {t("copyLink")}
      </Button>
      <p role="status" className={copyStatus ? "helper-text" : "sr-only"}>
        {copyStatus}
      </p>
    </div>
  );
}

export function LoginView() {
  const t = useTranslations("login");
  const router = useRouter();
  const next = workspaceReturn(useSearchParams().get("next"));
  const { session, checking, signIn, signingIn, error: authError } = useAuth();
  const { status } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const restoring = checking || status === "reconnecting";
  const connecting = isPending || status === "connecting";

  useEffect(() => {
    if (!session) return;
    // Preserve the fragment exactly when returning from the sign-in route.
    if (next.includes("#")) window.location.replace(next);
    else router.replace(next);
  }, [next, router, session]);

  return (
    <div className="app-shell">
      <AppHeader showWallet={false} />
      <main className="site-container play-page">
        <CardCustom className="grid gap-4 md:grid-cols-2">
          <PageHeader title={t("title")} description={t("description")} />
          <div className="grid min-w-0 gap-3">
            {status !== "connected" &&
              connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  tone="primary"
                  disabled={restoring || connecting}
                  onClick={() => connect({ connector })}
                >
                  <Icon name="wallet" />
                  {connector.id === "injected"
                    ? t("browser")
                    : t("connector", { name: connector.name })}
                </Button>
              ))}
            {status === "connected" && !session && (
              <>
                <p className="text-description">{t("signatureHelp")}</p>
                <Button
                  tone="primary"
                  onClick={signIn}
                  disabled={restoring || signingIn}
                >
                  <Icon name="wallet" />
                  {t(signingIn ? "signing" : "signIn")}
                </Button>
                {authError && (
                  <p role="alert" className="text-status-danger">
                    {t(
                      authError === "unavailable"
                        ? "sessionUnavailable"
                        : "signatureFailed",
                    )}
                  </p>
                )}
              </>
            )}
            {(restoring || connecting) && (
              <p role="status" className="text-description">
                {t(restoring ? "restoring" : "connecting")}
              </p>
            )}
            {error &&
              !restoring &&
              !connecting &&
              (error instanceof ProviderNotFoundError ? (
                <WalletSetupHelp />
              ) : (
                <p role="alert" className="text-sm text-status-danger">
                  {t("failed")}
                </p>
              ))}
            <p className="text-description">MetaMask / Core · {NETWORK_NAME}</p>
          </div>
          <nav
            aria-label={t("guest")}
            className="flex flex-wrap gap-2 border-t border-border pt-4 md:col-span-2"
          >
            <Link href="/hotseat" className="button-secondary">
              {t("hotseat")}
            </Link>
            <Link href="/practice" className="button-secondary">
              {t("practice")}
            </Link>
          </nav>
        </CardCustom>
      </main>
    </div>
  );
}
