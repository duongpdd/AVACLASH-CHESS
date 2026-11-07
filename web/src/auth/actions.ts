"use server";

import { cookies } from "next/headers";
import {
  createPublicClient,
  getAddress,
  http,
  isHex,
  verifyMessage,
} from "viem";
import { CHAIN_ID, RPC_URL } from "@/config/env";
import {
  browserCookie,
  browserSession,
  challengeCookie,
  loginOrigin,
} from "./server-session";
import {
  challengeAge,
  createClaims,
  readClaims,
  sessionAge,
  sessionSecret,
  signClaims,
} from "./session-token";
import { walletAddress, type WalletSession } from "./session-type";
import { walletMessage } from "./wallet-message";

function options(origin: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function startWalletLogin(input: string) {
  const address = walletAddress.safeParse(input);
  const secret = sessionSecret();
  if (!secret) return { error: "unavailable" } as const;
  const origin = await loginOrigin();
  if (!origin || !address.success) return { error: "invalid" } as const;
  const challenge = createClaims(
    "challenge",
    getAddress(address.data),
    origin,
    challengeAge,
  );
  (await cookies()).set(
    challengeCookie,
    signClaims(challenge, secret),
    options(origin, challengeAge),
  );
  return { message: walletMessage(challenge) };
}

export async function finishWalletLogin(signature: string) {
  const secret = sessionSecret();
  if (!secret) return { error: "unavailable" } as const;
  const origin = await loginOrigin();
  const jar = await cookies();
  const challenge = readClaims(
    jar.get(challengeCookie)?.value,
    "challenge",
    secret,
  );
  jar.delete(challengeCookie);
  if (
    !origin ||
    challenge?.origin !== origin ||
    typeof signature !== "string" ||
    signature.length > 8192 ||
    !isHex(signature)
  )
    return { error: "invalid" } as const;

  const proof = {
    address: challenge.address,
    message: walletMessage(challenge),
    signature,
  };
  // Verify ordinary wallets locally. Smart contract wallets can verify on the configured chain.
  let valid = await verifyMessage(proof).catch(() => false);
  if (!valid && [31337, 43113].includes(CHAIN_ID)) {
    valid = await createPublicClient({
      transport: http(RPC_URL, { timeout: 4000, retryCount: 0 }),
    })
      .verifyMessage(proof)
      .catch(() => false);
  }
  if (!valid || challenge.expiresAt <= Date.now())
    return { error: "invalid" } as const;

  const session = createClaims(
    "session",
    challenge.address,
    origin,
    sessionAge,
  );
  jar.set(
    browserCookie,
    signClaims({ ...session, purpose: "browser" }, secret),
    options(origin, sessionAge),
  );
  return {
    session: {
      token: signClaims(session, secret),
      user: { address: session.address },
      expiresAt: session.expiresAt,
    } satisfies WalletSession,
  };
}

export async function restoreWalletSession(
  token: string,
): Promise<WalletSession | null> {
  const secret = sessionSecret();
  if (!secret || typeof token !== "string") return null;
  const [browser, origin] = await Promise.all([
    browserSession(),
    loginOrigin(),
  ]);
  const session = readClaims(token, "session", secret);
  if (
    !origin ||
    !browser ||
    !session ||
    session.origin !== origin ||
    browser.origin !== origin ||
    browser.address !== session.address ||
    browser.id !== session.id
  )
    return null;
  return {
    token,
    user: { address: session.address },
    expiresAt: session.expiresAt,
  };
}

export async function endWalletSession(token: string) {
  if (await restoreWalletSession(token))
    (await cookies()).delete(browserCookie);
}
