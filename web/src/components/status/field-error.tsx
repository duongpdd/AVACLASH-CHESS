import { useUiCopy } from "@/i18n/use-ui-copy";

export function FieldError({ message, id }: { message?: string; id?: string }) {
  const uiText = useUiCopy();
  return message ? (
    <span id={id} role="alert" className="block text-sm text-status-danger">
      {uiText.existing(message)}
    </span>
  ) : null;
}
