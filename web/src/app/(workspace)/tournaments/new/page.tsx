import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/tournament-create/tournament-create-view";

export function generateMetadata() {
  return pageMetadata("messageOrganizeATournament", "/tournaments/new");
}
