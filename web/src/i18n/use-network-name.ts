import { useTranslations } from "next-intl";
import { CHAIN_ID } from "@/config/env";

/** The chain configuration stays technical; its displayed name is localized. */
export function useNetworkName() {
  const t = useTranslations("network");
  return t(CHAIN_ID === 31337 ? "local" : "fuji");
}
