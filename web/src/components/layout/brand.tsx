import Link from "next/link";
import { Crown } from "lucide-react";
import { useTranslations } from "next-intl";
import FujiTestnetBanner from "@/components/fuji-testnet-banner";

export function Brand() {
  const t = useTranslations("brand");
  return (
    <Link href="/" className="brand" aria-label="AvaClash Cup">
      <span className="brand-mark">
        <Crown size={20} aria-hidden />
      </span>
      <span className="brand-name">
        {t("name")}
        <span className="brand-subline">
          {t("cup")} <FujiTestnetBanner compact />
        </span>
      </span>
    </Link>
  );
}
