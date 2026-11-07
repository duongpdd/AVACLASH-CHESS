"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useAccount, useSignMessage } from "wagmi";
import { isAddressEqual } from "viem";
import { useClientMounted } from "@/hooks/use-client-mounted";
import {
  endWalletSession,
  finishWalletLogin,
  restoreWalletSession,
  startWalletLogin,
} from "@/auth/actions";
import type { WalletSession } from "@/auth/session-type";

const storageKey = "avaclash.session";
const storageEvent = "avaclash-session-changed";
const sessionKey = (token?: string) => ["wallet-session", token];

function readStorage(): WalletSession | null {
  try {
    const record = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return record &&
      typeof record.token === "string" &&
      record.user?.address &&
      Number.isFinite(record.expiresAt)
      ? record
      : null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(storageEvent, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(storageEvent, callback);
  };
}

function save(session: WalletSession | null) {
  if (session) localStorage.setItem(storageKey, JSON.stringify(session));
  else localStorage.removeItem(storageKey);
  window.dispatchEvent(new Event(storageEvent));
}

type AuthState = {
  session: WalletSession | null;
  checking: boolean;
  signIn: () => void;
  signOut: () => Promise<void>;
  signingIn: boolean;
  error?: "invalid" | "unavailable";
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const account = useAccount();
  const previouslyConnected = useRef(false);
  const token = useSyncExternalStore(
    subscribe,
    () => readStorage()?.token,
    () => undefined,
  );
  const hydrated = useClientMounted();
  const queryClient = useQueryClient();
  const { signMessageAsync } = useSignMessage();
  const query = useQuery({
    queryKey: sessionKey(token),
    queryFn: () => (token ? restoreWalletSession(token) : null),
    enabled: !!token,
    retry: false,
    staleTime: 60_000,
  });
  const signIn = useMutation({
    mutationFn: async () => {
      if (!account.address) throw new Error("invalid");
      const challenge = await startWalletLogin(account.address);
      if ("error" in challenge) throw new Error(challenge.error);
      const signature = await signMessageAsync({
        account: account.address,
        message: challenge.message,
      });
      const result = await finishWalletLogin(signature);
      if ("error" in result) throw new Error(result.error);
      return result.session;
    },
    onSuccess(session) {
      queryClient.setQueryData(sessionKey(session.token), session);
      save(session);
    },
  });
  const current = query.data;
  const session =
    current &&
    account.address &&
    isAddressEqual(current.user.address, account.address)
      ? current
      : null;

  async function signOut() {
    const existing = readStorage();
    save(null);
    if (existing) {
      queryClient.removeQueries({ queryKey: sessionKey(existing.token) });
      await endWalletSession(existing.token).catch(() => {});
    }
  }

  useEffect(() => {
    if (account.status === "connected") previouslyConnected.current = true;
    if (!token) return;
    const changedAccount =
      current &&
      account.address &&
      !isAddressEqual(current.user.address, account.address);
    const disconnected =
      account.status === "disconnected" && previouslyConnected.current;
    if (changedAccount || disconnected || query.data === null) {
      if (readStorage()?.token === token) save(null);
      void endWalletSession(token).catch(() => {});
    }
  }, [account.address, account.status, current, query.data, token]);

  useEffect(() => {
    if (!current || !token) return;
    const timer = window.setTimeout(
      () => {
        if (readStorage()?.token === token) save(null);
        void endWalletSession(token).catch(() => {});
      },
      Math.max(0, current.expiresAt - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [current, token]);

  return (
    <AuthContext.Provider
      value={{
        session,
        checking: !hydrated || (!!token && query.isPending),
        signIn: () => signIn.mutate(),
        signOut,
        signingIn: signIn.isPending,
        error: signIn.isError
          ? signIn.error.message === "unavailable"
            ? "unavailable"
            : "invalid"
          : undefined,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("AuthProvider is required");
  return auth;
}
