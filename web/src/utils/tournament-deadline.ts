import { timeZone } from "@/i18n/routing";

type TournamentDeadline =
  | { key: "deadlineExpired" | "deadlineUnderHour"; values?: undefined }
  | { key: "deadlineHours"; values: { hours: number } }
  | { key: "deadlineDate"; values: { date: string } };

/** Both timestamps are chain seconds. Never use the browser clock here. */
export function tournamentDeadline(
  deadline: bigint,
  blockTime: bigint,
  locale: string,
): TournamentDeadline {
  const remaining = deadline - blockTime;
  if (remaining <= 0n) return { key: "deadlineExpired" } as const;
  if (remaining < 3600n) return { key: "deadlineUnderHour" } as const;
  if (remaining < 48n * 3600n)
    return {
      key: "deadlineHours",
      values: { hours: Number(remaining / 3600n) },
    } as const;
  const formatter = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  });
  const instant = new Date(Number(deadline) * 1000);
  const parts = formatter.formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)!.value;
  const date = locale.startsWith("vi")
    ? `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`
    : formatter.format(instant);
  return { key: "deadlineDate", values: { date } } as const;
}
