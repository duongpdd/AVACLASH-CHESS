import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { generatePrivateKey } from "viem/accounts";
import { parseSiweMessage } from "viem/siwe";
import {
  endWalletSession,
  finishWalletLogin,
  restoreWalletSession,
  startWalletLogin,
} from "@/auth/actions";
import { browserCookie, challengeCookie } from "@/auth/server-session";

const browser = vi.hoisted(() => ({
  jar: new Map<string, { value: string; options: Record<string, unknown> }>(),
  origin: "https://chess.example.test",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ origin: browser.origin }),
  cookies: async () => ({
    set(name: string, value: string, options: Record<string, unknown>) {
      browser.jar.set(name, { value, options });
    },
    get: (name: string) => browser.jar.get(name),
    delete: (name: string) => browser.jar.delete(name),
  }),
}));

vi.mock("@/config/env", () => ({
  CHAIN_ID: 31337,
  RPC_URL: "http://127.0.0.1:1",
}));

const wallet = privateKeyToAccount(generatePrivateKey());
const other = privateKeyToAccount(generatePrivateKey());

async function challenge() {
  const result = await startWalletLogin(wallet.address);
  if (!result.message) throw new Error("Expected a challenge");
  return result.message;
}

beforeEach(() => {
  vi.stubEnv("AUTH_SESSION_SECRET", "test-secret-for-signing-wallet-sessions");
  browser.origin = "https://chess.example.test";
  browser.jar.clear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("wallet session", () => {
  it("binds a signed message to an origin and restores a paired session", async () => {
    const message = await challenge();
    expect(parseSiweMessage(message)).toMatchObject({
      address: wallet.address,
      domain: "chess.example.test",
      uri: browser.origin,
      chainId: 31337,
    });
    expect(browser.jar.get(challengeCookie)?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      maxAge: 300,
    });
    const signature = await wallet.signMessage({ message });
    const result = await finishWalletLogin(signature);
    if (!result.session) throw new Error("Expected a valid session");
    expect(result.session.user).toEqual({ address: wallet.address });
    expect(browser.jar.has(challengeCookie)).toBe(false);
    expect(browser.jar.get(browserCookie)?.value).not.toBe(
      result.session.token,
    );
    expect(await restoreWalletSession(result.session.token)).toEqual(
      result.session,
    );
    expect(await finishWalletLogin(signature)).toEqual({ error: "invalid" });
    expect(await restoreWalletSession(result.session.token + "x")).toBeNull();
    await endWalletSession(result.session.token);
    expect(browser.jar.has(browserCookie)).toBe(false);
    expect(await restoreWalletSession(result.session.token)).toBeNull();
  });

  it("rejects a signature made by a different wallet", async () => {
    const signature = await other.signMessage({ message: await challenge() });
    expect(await finishWalletLogin(signature)).toEqual({ error: "invalid" });
    expect(browser.jar.has(browserCookie)).toBe(false);
  });

  it("rejects an expired or cross-origin challenge", async () => {
    vi.useFakeTimers();
    const signature = await wallet.signMessage({ message: await challenge() });
    vi.setSystemTime(Date.now() + 300_000);
    expect(await finishWalletLogin(signature)).toEqual({ error: "invalid" });
    const next = await wallet.signMessage({ message: await challenge() });
    browser.origin = "https://other.example.test";
    expect(await finishWalletLogin(next)).toEqual({ error: "invalid" });
  });

  it("rejects a valid local token after expiry or without its browser cookie", async () => {
    vi.useFakeTimers();
    const signature = await wallet.signMessage({ message: await challenge() });
    const result = await finishWalletLogin(signature);
    if (!result.session) throw new Error("Expected a valid session");
    const saved = browser.jar.get(browserCookie)!;
    browser.jar.delete(browserCookie);
    expect(await restoreWalletSession(result.session.token)).toBeNull();
    browser.jar.set(browserCookie, saved);
    vi.setSystemTime(result.session.expiresAt);
    expect(await restoreWalletSession(result.session.token)).toBeNull();
  });
});
