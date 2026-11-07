import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { localeCookie, routing, timeZone } from "./routing";
import vi from "@/messages/vi.json";
import en from "@/messages/en.json";

export default getRequestConfig(async () => {
  const selected = (await cookies()).get(localeCookie)?.value;
  const locale = hasLocale(routing.locales, selected)
    ? selected
    : routing.defaultLocale;
  return { locale, messages: locale === "en" ? en : vi, timeZone };
});
