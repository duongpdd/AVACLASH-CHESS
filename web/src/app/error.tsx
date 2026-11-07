"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";

export default function RouteError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const t = useTranslations("errors");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="app-shell">
      <main className="site-container play-page">
        <PageHeader title={t("errorTitle")} description={t("errorDetail")} />
        <div className="flex flex-wrap gap-2">
          <Button tone="primary" onClick={() => retry()}>
            {t("retry")}
          </Button>
          <Link className="button-secondary" href="/">
            {t("home")}
          </Link>
        </div>
      </main>
    </div>
  );
}
