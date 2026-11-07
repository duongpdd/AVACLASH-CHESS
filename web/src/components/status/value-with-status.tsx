import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export function ValueLoading() {
  const t = useTranslations("statusDisplay");
  return (
    <span
      role="status"
      aria-label={t("loading")}
      className="inline-block h-3 w-12 rounded bg-muted motion-safe:animate-pulse"
    />
  );
}

export function NAValue() {
  return <span className="text-muted-foreground">--</span>;
}

export function ValueWithStatus({
  error,
  loading,
  noData,
  children,
}: {
  error?: boolean;
  loading?: boolean;
  noData?: boolean;
  children: ReactNode;
}) {
  if (error) return <NAValue />;
  if (loading) return <ValueLoading />;
  if (noData) return <NAValue />;
  return children;
}
