import type { MetadataRoute } from "next";
import { publicPaths, siteUrl } from "@/lib/metadata";

export default function sitemap(): MetadataRoute.Sitemap {
  return publicPaths.map((path) => ({ url: new URL(path, siteUrl).href }));
}
