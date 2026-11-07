import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/home/home-view";

export function generateMetadata() {
  return pageMetadata("messagePlayChess", "/");
}
