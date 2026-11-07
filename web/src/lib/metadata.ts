import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import type { UiKey } from "@/i18n/ui-copy";

export const siteName = "AvaClash Chess";
export const siteUrl = new URL(
  process.env.NEXT_PUBLIC_SITE_URL || "https://avaclash-chess.vercel.app",
);

export const publicPaths = [
  "/",
  "/guide",
  "/hotseat",
  "/practice",
  "/ranking",
  "/tournaments",
] as const;
export const privatePaths = [
  "/game",
  "/profile",
  "/vault",
  "/tournaments/new",
  "/tournaments/play",
] as const;

export async function rootMetadata(): Promise<Metadata> {
  const t = await getTranslations("seo");
  return {
    metadataBase: siteUrl,
    title: { default: siteName, template: `%s | ${siteName}` },
    description: t("description"),
  };
}

export async function pageMetadata(
  key: UiKey,
  path: string,
): Promise<Metadata> {
  const [t, seo, locale] = await Promise.all([
    getTranslations("ui"),
    getTranslations("seo"),
    getLocale(),
  ]);
  const title = t(key);
  const description = seo("description");
  const index = publicPaths.some((entry) => entry === path);
  return {
    title,
    robots: { index, follow: index },
    ...(index && {
      alternates: { canonical: path },
      openGraph: {
        title,
        description,
        url: path,
        siteName,
        locale: locale === "vi" ? "vi_VN" : "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ["/opengraph-image"],
      },
    }),
  };
}
