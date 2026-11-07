import Link from "next/link";
import { getTranslations } from "next-intl/server";
import AppFooter from "@/components/app-footer";
import AppHeader from "@/components/app-header";
import { PageHeader } from "@/components/ui/page-header";
import { pageMetadata } from "@/lib/metadata";

export function generateMetadata() {
  return pageMetadata("messagePageNotFound", "/404");
}

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <div className="app-shell">
      <AppHeader active="none" />
      <main className="site-container play-page">
        <PageHeader
          eyebrow={t("notFoundEyebrow")}
          title={t("notFoundTitle")}
          description={t("notFoundDetail")}
        />
        <Link className="button-primary w-fit" href="/">
          {t("home")}
        </Link>
      </main>
      <AppFooter />
    </div>
  );
}
