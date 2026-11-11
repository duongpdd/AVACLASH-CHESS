import Link from "next/link";
import { useTranslations } from "next-intl";
import { useNetworkName } from "@/i18n/use-network-name";
import { Crown } from "lucide-react";
export default function AppFooter() {
  const t = useTranslations("navigation");
  const network = useNetworkName();
  return (
    <footer className="site-container app-footer">
      <span className="footer-brand">
        <Crown size={16} aria-hidden />
        AvaClash Cup
      </span>
      <div className="footer-links">
        <span className="network-label">{network}</span>
        <Link href="/guide" className="hover:text-foreground">
          {t("guide")}
        </Link>
      </div>
    </footer>
  );
}
