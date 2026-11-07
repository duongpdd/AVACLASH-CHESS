import { describe, expect, it } from "vitest";
import {
  contentSecurityPolicy,
  securityHeaders,
} from "@/config/security-headers";

const directive = (csp: string, name: string) =>
  csp.split("; ").find((entry) => entry.startsWith(`${name} `));

describe("security headers", () => {
  const fuji = {
    chainId: "43113",
    rpcUrl: "https://rpc.example.org/ext/bc/C/rpc",
    relayUrl: "wss://relay.example.org",
  };

  it("blocks framing and keeps eval out of production", () => {
    const csp = contentSecurityPolicy(fuji);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(directive(csp, "script-src")).not.toContain("unsafe-eval");
    const names = securityHeaders(fuji).map(({ key }) => key);
    expect(names).toContain("X-Frame-Options");
    expect(names).toContain("X-Content-Type-Options");
  });

  it("allows the configured RPC and both relay protocols", () => {
    const connect = directive(contentSecurityPolicy(fuji), "connect-src");
    expect(connect).toContain("https://rpc.example.org");
    expect(connect).toContain("wss://relay.example.org");
    expect(connect).toContain("https://relay.example.org");
    expect(connect).not.toContain("127.0.0.1");
  });

  it("allows the local chain and an insecure relay on Anvil", () => {
    const connect = directive(
      contentSecurityPolicy({
        chainId: "31337",
        rpcUrl: "http://127.0.0.1:8545",
        relayUrl: "ws://localhost:8080",
      }),
      "connect-src",
    );
    expect(connect).toContain("http://127.0.0.1:8545");
    expect(connect).toContain("ws://localhost:8080");
    expect(connect).toContain("http://localhost:8080");
  });

  it("allows eval and hot reload only in development", () => {
    const csp = contentSecurityPolicy({ isDev: true });
    expect(directive(csp, "script-src")).toContain("unsafe-eval");
    expect(directive(csp, "connect-src")).toContain("ws:");
  });
});
