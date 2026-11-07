import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/game/game-view";

export function generateMetadata() {
  return pageMetadata("messageMatch4", "/game");
}
