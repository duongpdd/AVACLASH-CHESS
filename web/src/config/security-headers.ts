// Imported by next.config.ts, so keep this file free of "@/" aliases and app code.
const FUJI_RPC_ORIGINS = [
  "https://api.avax-test.network",
  "https://avalanche-fuji-c-chain-rpc.publicnode.com",
];

type SecurityEnv = {
  chainId?: string;
  rpcUrl?: string;
  relayUrl?: string;
  isDev?: boolean;
};

function origin(url: string) {
  return new URL(url).origin;
}

/** The relay serves match sockets on ws(s) and tournament replays on http(s). */
function relayOrigins(url: string) {
  const parsed = new URL(url);
  const secure = parsed.protocol === "wss:" || parsed.protocol === "https:";
  return [
    `${secure ? "wss" : "ws"}://${parsed.host}`,
    `${secure ? "https" : "http"}://${parsed.host}`,
  ];
}

export function contentSecurityPolicy({
  chainId = "43113",
  rpcUrl,
  relayUrl = "ws://localhost:8080",
  isDev = false,
}: SecurityEnv) {
  const local = isDev || chainId === "31337";
  const connect = new Set([
    "'self'",
    ...FUJI_RPC_ORIGINS,
    ...relayOrigins(relayUrl),
    ...(rpcUrl ? [origin(rpcUrl)] : []),
    ...(local ? ["http://127.0.0.1:8545"] : []),
    // Next.js hot reload.
    ...(isDev ? ["ws:"] : []),
  ]);

  return [
    "default-src 'self'",
    // Next.js streams inline bootstrap scripts; pages are not nonce-rendered.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    // Phaser builds piece textures from generated canvases and data URLs.
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
    `connect-src ${[...connect].join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");
}

export function securityHeaders(env: SecurityEnv) {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(env) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
  ];
}
