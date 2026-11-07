import type { NextConfig } from "next";
import path from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import { securityHeaders } from "./src/config/security-headers";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  transpilePackages: ["@avaclash/shared"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          chainId: process.env.NEXT_PUBLIC_CHAIN_ID,
          rpcUrl: process.env.NEXT_PUBLIC_RPC_URL,
          relayUrl: process.env.NEXT_PUBLIC_RELAY_URL,
          isDev: process.env.NODE_ENV === "development",
        }),
      },
    ];
  },
  webpack: (config) => {
    // Wagmi includes optional third-party wallet connectors that are optional peer dependencies:
    // (@coinbase/wallet-sdk, @metamask/connect-evm, @safe-global/safe-apps-sdk, @safe-global/safe-apps-provider,
    //  @walletconnect/ethereum-provider, @base-org/account, accounts).
    // AvaClash uses the standard injected EIP-1193 connector without third-party wallet SDKs.
    // Suppress ONLY these specific optional module resolution warnings:
    const optionalWagmiModules = [
      "@coinbase/wallet-sdk",
      "@metamask/connect-evm",
      "@safe-global/safe-apps-sdk",
      "@safe-global/safe-apps-provider",
      "@walletconnect/ethereum-provider",
      "@base-org/account",
      "accounts",
    ];

    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      ...optionalWagmiModules.map((mod) => ({
        message: new RegExp(mod.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")),
      })),
    ];
    return config;
  },
};

export default createNextIntlPlugin()(nextConfig);
