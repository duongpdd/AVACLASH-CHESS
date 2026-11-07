import { pageMetadata } from "@/lib/metadata";

export { default } from "@/views/vault/vault-view";

export function generateMetadata() {
  return pageMetadata("messagePrincipalVault", "/vault");
}
