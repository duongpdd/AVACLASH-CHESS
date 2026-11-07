import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/profile/profile-view";

export function generateMetadata() {
  return pageMetadata("messageProfile", "/profile");
}
