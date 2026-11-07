import type { ReactNode } from "react";
import { browserSession } from "@/auth/server-session";
import WalletGate from "@/components/wallet-gate";
import { AppShell } from "@/components/layout/app-shell";

export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await browserSession();
  return (
    <WalletGate serverAddress={session?.address}>
      {session && <AppShell>{children}</AppShell>}
    </WalletGate>
  );
}
