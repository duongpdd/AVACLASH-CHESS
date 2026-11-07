const classes = {
  success: "bg-status-success/10 text-status-success border-status-success/25",
  warning: "bg-status-warning/10 text-status-warning border-status-warning/25",
  danger: "bg-status-danger/10 text-status-danger border-status-danger/25",
  deactivated:
    "bg-status-deactivated/10 text-status-deactivated border-status-deactivated/25",
  info: "bg-status-info/10 text-status-info border-status-info/25",
  progress:
    "bg-status-progress/10 text-status-progress border-status-progress/25",
  contract:
    "bg-status-contract/10 text-status-contract border-status-contract/25",
  neutral: "bg-muted text-muted-foreground border-border",
} as const;

export type StatusTone = keyof typeof classes;

export function statusBadgeClass(tone: StatusTone = "neutral") {
  return classes[tone];
}
