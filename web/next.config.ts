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
    // Wagmi includes optional third-party wallet connectors (@coinbase/wallet-sdk, @metamask/connect-evm,
    // @safe-global/safe-apps-sdk, @walletconnect/ethereum-provider, @base-org/account, tempo accounts)
    // which are optional peer dependencies. Since AvaClash uses the standard injected EIP-1193 connector
    // without third-party wallet SDKs, suppress these benign "Module not found" warnings in Webpack.
    config.ignoreWarnings = [
      ...(config.ignoreWarnings || []),
      {
        module: /@wagmi[/\\]connectors/,
        message: /Module not found/,
      },
      {
        module: /@wagmi[/\\]core/,
        message: /Module not found/,
      },
    ];
    return config;
  },
};

export default nextConfig;
