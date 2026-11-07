import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/guide/guide-view";

export function generateMetadata() {
  return pageMetadata("messageGuide", "/guide");
}
