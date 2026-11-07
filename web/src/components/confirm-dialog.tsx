"use client";

import { useUiCopy } from "@/i18n/use-ui-copy";
import { CardCustom } from "@/components/ui/card-custom";
import { Button } from "@/components/ui/button";
import { useId } from "react";
import Dialog from "./modal-dialog";

export default function ConfirmDialog({
  title,
  description,
  confirmLabel,
  disabled,
  onClose,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  disabled?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const uiText = useUiCopy();
  const titleId = useId();
  return (
    <Dialog titleId={titleId} onClose={onClose}>
      <CardCustom as="div" className="w-full max-w-sm space-y-4">
        <h2 id={titleId} className="text-description font-semibold">
          {title}
        </h2>
        <p className="helper-text">{description}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" onClick={onClose}>
            {uiText("messageBack")}
          </Button>
          <Button
            type="button"
            tone="primary"
            disabled={disabled}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </CardCustom>
    </Dialog>
  );
}
