import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["vi", "en"],
  defaultLocale: "vi",
  localePrefix: "never",
});
export const localeCookie = "NEXT_LOCALE";
export const timeZone = "Asia/Ho_Chi_Minh";
