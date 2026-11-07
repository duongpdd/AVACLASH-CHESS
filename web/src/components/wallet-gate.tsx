"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { isAddressEqual, type Address } from "viem";
import { useAccount, useConfig } from "wagmi";
import { useClientMounted } from "@/hooks/use-client-mounted";

export default function WalletGate({
  children,
  serverAddress,
}: {
  children: ReactNode;
  serverAddress?: Address;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useClientMounted();
  const { status } = useAccount();
  const config = useConfig();
  const { session, checking } = useAuth();
  const allowed =
    session &&
    serverAddress &&
    isAddressEqual(session.user.address, serverAddress);

  useEffect(() => {
    if (
      !mounted ||
      checking ||
      allowed ||
      status === "reconnecting" ||
      status === "connecting"
    )
      return;
    // Let Wagmi hydrate local storage and start reconnecting before routing away.
    const timer = window.setTimeout(() => {
      if (
        config.state.status === "reconnecting" ||
        config.state.status === "connecting"
      )
        return;
      const { search, hash } = window.location;
      const next = encodeURIComponent(pathname + search + hash);
      router.replace(`/login?next=${next}`);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [allowed, checking, config, mounted, pathname, router, status]);

  return mounted && allowed ? children : null;
}
