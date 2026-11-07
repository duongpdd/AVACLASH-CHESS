import { routing, timeZone } from "@/i18n/routing";

export function formatDateTime(
  seconds: bigint,
  locale: string = routing.defaultLocale,
) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(Number(seconds) * 1000));
}
