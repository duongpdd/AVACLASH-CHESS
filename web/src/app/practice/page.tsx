import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/practice/practice-view";

export function generateMetadata() {
  return pageMetadata("messageSolveAPuzzle", "/practice");
}
