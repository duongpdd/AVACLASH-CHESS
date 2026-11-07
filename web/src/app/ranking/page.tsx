import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/ranking/ranking-view";

export function generateMetadata() {
  return pageMetadata("messageRank", "/ranking");
}
