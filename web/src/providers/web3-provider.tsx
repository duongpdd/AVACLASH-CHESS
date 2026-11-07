"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { ToastContainer } from "react-toastify";
import { ThemeProvider, useTheme } from "./theme-provider";
import { AuthProvider } from "./auth-provider";
import { config } from "@/config/wagmi";
import { useState, type ReactNode } from "react";

export function Web3Provider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WagmiProvider config={config}>
          <AuthProvider>
            {children}
            <ThemedToast />
          </AuthProvider>
        </WagmiProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

function ThemedToast() {
  const { dark } = useTheme();
  return <ToastContainer theme={dark ? "dark" : "light"} />;
}
