import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export function Failed({ children }: { children?: ReactNode }) {
  const t = useTranslations("statusDisplay");
  return (
    <div role="alert" className="text-status-danger">
      {children ?? t("failed")}
    </div>
  );
}

export function Loading({ children }: { children?: ReactNode }) {
  const t = useTranslations("statusDisplay");
  return (
    <p role="status" className="flex items-center gap-2 text-description">
      <span
        aria-hidden
        className="size-4 rounded-full border-2 border-border border-t-primary motion-safe:animate-spin"
      />
      {children ?? t("loading")}
    </p>
  );
}

export function NoData({ children }: { children?: ReactNode }) {
  const t = useTranslations("statusDisplay");
  return (
    <div className="empty-data">
      <span className="empty-data-icon">
        <Inbox size={20} aria-hidden />
      </span>
      <div className="text-description min-w-0">{children ?? t("noData")}</div>
    </div>
  );
}

export function DataWithStatus({
  error,
  loading,
  noData,
  children,
}: {
  error?: ReactNode;
  loading?: boolean;
  noData?: ReactNode;
  children: ReactNode;
}) {
  if (error) return <Failed>{error === true ? undefined : error}</Failed>;
  if (loading) return <Loading />;
  if (noData) return <NoData>{noData === true ? undefined : noData}</NoData>;
  return children;
}
