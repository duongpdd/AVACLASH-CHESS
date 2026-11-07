import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/tournament-play/tournament-play-view";

export function generateMetadata() {
  return pageMetadata("messageCupMatch", "/tournaments/play");
}
