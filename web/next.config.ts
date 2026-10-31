import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@avaclash/shared"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
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

export default nextConfig;
