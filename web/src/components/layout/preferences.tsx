"use client";

import { Moon, Sun } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { localeCookie } from "@/i18n/routing";
import { useTheme } from "@/providers/theme-provider";

export function Preferences() {
  const { dark, toggle } = useTheme();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const router = useRouter();

  return (
    <div className="preferences">
      <button
        type="button"
        className="preference-button text-label"
        aria-label={t("changeLanguage")}
        onClick={() => {
          document.cookie = `${localeCookie}=${locale === "vi" ? "en" : "vi"}; Path=/; Max-Age=31536000; SameSite=Lax`;
          router.refresh();
        }}
      >
        {locale === "vi" ? "EN" : "VI"}
      </button>
      <button
        type="button"
        className="preference-button"
        aria-label={t(dark ? "lightMode" : "darkMode")}
        onClick={toggle}
      >
        {dark ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
      </button>
    </div>
  );
}
