import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/tournaments/tournaments-view";

export function generateMetadata() {
  return pageMetadata("messageTournaments", "/tournaments");
}
