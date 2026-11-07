import Link from "next/link";
import { useTranslations } from "next-intl";
import { NETWORK_NAME } from "@/config/env";
export default function AppFooter() {
  const t = useTranslations("navigation");
  return (
    <footer className="site-container app-footer">
      <span>AvaClash Chess</span>
      <div className="flex items-center gap-5">
        <span>{NETWORK_NAME}</span>
        <Link href="/guide" className="hover:text-foreground">
          {t("guide")}
        </Link>
      </div>
    </footer>
  );
}
