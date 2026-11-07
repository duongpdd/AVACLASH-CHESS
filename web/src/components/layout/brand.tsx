import Link from "next/link";
import { Crown } from "lucide-react";

export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex min-h-11 items-center gap-2 font-semibold"
      aria-label="AvaClash Chess"
    >
      <span className="grid size-8 place-items-center rounded-dropdown bg-primary text-primary-foreground">
        <Crown size={20} aria-hidden />
      </span>
      <span>AvaClash</span>
    </Link>
  );
}
