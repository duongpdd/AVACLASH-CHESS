import CollectionView from "@/components/cosmetics/collection-view";
import { pageMetadata } from "@/lib/metadata";

export function generateMetadata() {
  return pageMetadata("messageCollection", "/collection");
}

export default CollectionView;
