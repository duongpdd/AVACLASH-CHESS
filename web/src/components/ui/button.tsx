import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Button({
  tone = "ghost",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { tone?: "primary" | "ghost" }) {
  return (
    <button
      type={type}
      className={cn(
        tone === "primary" ? "button-primary" : "button-secondary",
        className,
      )}
      {...props}
    />
  );
}
