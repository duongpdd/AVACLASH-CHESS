import type { ReactNode } from "react";
import Icon from "./app-icon";
import { CardCustom } from "@/components/ui/card-custom";
import { statusBadgeClass, type StatusTone } from "@/utils/status-badge-colors";

export function Skeleton({ label }: { label: string }) {
  return (
    <CardCustom className="grid gap-3" role="status">
      <span className="sr-only">{label}</span>
      <span
        aria-hidden="true"
        className="h-5 w-1/3 rounded bg-foreground/10 motion-safe:animate-pulse"
      />
      <span
        aria-hidden="true"
        className="h-4 w-4/5 rounded bg-foreground/10 motion-safe:animate-pulse"
      />
      <span
        aria-hidden="true"
        className="h-4 w-2/3 rounded bg-foreground/10 motion-safe:animate-pulse"
      />
    </CardCustom>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <CardCustom className="grid justify-items-start gap-2">
      <Icon name="info" className="text-status-warning" />
      <p className="font-semibold">{title}</p>
      {description && <p className="helper-text">{description}</p>}
      {action}
    </CardCustom>
  );
}

export function StatusPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: StatusTone;
}) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2 py-1 text-xs ${statusBadgeClass(tone)}`}
    >
      {children}
    </span>
  );
}
