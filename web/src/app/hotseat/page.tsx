import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/hotseat/hotseat-view";

export function generateMetadata() {
  return pageMetadata("messagePlayOnTheSameDevice", "/hotseat");
}
