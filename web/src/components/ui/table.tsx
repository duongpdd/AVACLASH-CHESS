import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Table({ className, ...props }: ComponentProps<"table">) {
  return (
    <div className="max-w-full overflow-x-auto">
      <table
        className={cn("text-data w-full text-left", className)}
        {...props}
      />
    </div>
  );
}
export function TableHeader(props: ComponentProps<"thead">) {
  return <thead {...props} />;
}
export function TableBody(props: ComponentProps<"tbody">) {
  return <tbody {...props} />;
}
export function TableRow(props: ComponentProps<"tr">) {
  return <tr {...props} />;
}
export function TableHead({
  scope = "col",
  className,
  ...props
}: ComponentProps<"th">) {
  return (
    <th
      scope={scope}
      className={cn("text-label text-muted-foreground", className)}
      {...props}
    />
  );
}
export function TableCell(props: ComponentProps<"td">) {
  return <td {...props} />;
}
