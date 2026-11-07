import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/lib/utils";

export function CardCustom({
  as: Tag = "section",
  className,
  ...props
}: ComponentPropsWithoutRef<"section"> & {
  as?: "section" | "div" | "article";
}) {
  return <Tag className={cn("surface-card", className)} {...props} />;
}
