import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { localizeExisting, type UiText } from "./ui-copy";

export function useUiCopy() {
  const translate = useTranslations("ui");
  return useMemo(() => {
    const text: UiText = (key, values) => translate(key, values);
    return Object.assign(text, {
      existing: (value: string) => localizeExisting(value, text),
    });
  }, [translate]);
}
