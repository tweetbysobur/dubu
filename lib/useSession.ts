"use client";

import { useEffect, useRef } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Me } from "./api";
import { createPasskeyWallet, forgetPasskey, openPasskeyWallet, passkeyErrorMessage } from "./passkey";

async function signInWith(address: string, sign: (message: string) => Promise<string>) {
  const { message } = await api<{ message: string }>(`/api/auth/nonce?address=${address}`);
  const signature = await sign(message);
  await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ address, signature }) });
}

/** Read-only session for places like the header. Shares the cache with useSession. */
export function useMe() {
  return useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<Me>("/api/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    retry: false,
    staleTime: 30_000,
  });
}

/** Ends the server session and disconnects any external wallet. */
export function useSignOut() {
  const qc = useQueryClient();
  const { isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  return useMutation({
    mutationFn: async () => {
      await api("/api/auth/logout", { method: "POST" }).catch(() => {});
      if (isConnected) disconnect();
    },
    onSettled: () => qc.setQueryData(["me"], null),
  });
}

/**
 * Full session for the page. Use once per screen: it auto-prompts a connected
 * wallet to sign, which must not happen twice.
 *
 * The server session is the source of truth. Two ways to get one:
 *  - passkey: Mera derives a wallet in the browser and signs the login message
 *  - wallet: an external wallet (for Chog holders) signs the same message
 *
 * States: loading -> signed-out | wallet-signing | ready | error
 */
export function useSession() {
  const qc = useQueryClient();
  const { address: walletAddress, isConnected, status: walletStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const me = useMe();
  const signOut = useSignOut();

  const done = () => qc.invalidateQueries({ queryKey: ["me"] });

  const passkey = useMutation({
    mutationFn: async (mode: "create" | "open" | "open-any") => {
      let wallet;
      try {
        wallet = mode === "create" ? await createPasskeyWallet() : await openPasskeyWallet(mode === "open-any");
      } catch (e) {
        throw new Error(passkeyErrorMessage(e));
      }
      try {
        await signInWith(wallet.account.address, (message) => wallet.account.signMessage({ message }));
      } finally {
        wallet.end(); // the key is only needed for this one signature
      }
    },
    onSuccess: done,
  });

  const walletSignIn = useMutation({
    mutationFn: async () => {
      if (!walletAddress) throw new Error("Connect a wallet first.");
      await signInWith(walletAddress, async (message) => {
        try {
          return await signMessageAsync({ message });
        } catch {
          throw new Error("The signature was cancelled. Sign the message in your wallet to continue.");
        }
      });
    },
    onSuccess: done,
  });

  // A wallet connected with no session yet: ask it to sign right away, once per address.
  const autoTried = useRef<string | null>(null);
  const needsWalletSig = isConnected && !!walletAddress && me.data === null;
  useEffect(() => {
    if (!needsWalletSig || walletSignIn.isPending || autoTried.current === walletAddress) return;
    autoTried.current = walletAddress!;
    walletSignIn.mutate();
  }, [needsWalletSig, walletAddress, walletSignIn]);

  // The wallet that owns this session switched accounts: the session no longer matches it.
  // A wallet connected only to be linked (passkey session) never ends the session.
  const lastWallet = useRef<string | undefined>(undefined);
  const sessionAddress = me.data?.address;
  useEffect(() => {
    const ownedSession = !!lastWallet.current && sessionAddress === lastWallet.current.toLowerCase();
    if (ownedSession && walletAddress && lastWallet.current !== walletAddress) {
      autoTried.current = null;
      api("/api/auth/logout", { method: "POST" }).finally(() => qc.setQueryData(["me"], null));
    }
    lastWallet.current = walletAddress;
  }, [walletAddress, sessionAddress, qc]);

  let state: "loading" | "signed-out" | "wallet-signing" | "ready" | "error";
  if (me.isPending || walletStatus === "reconnecting") state = "loading";
  else if (me.isError) state = "error";
  else if (me.data) state = "ready";
  else if (needsWalletSig) state = "wallet-signing";
  else state = "signed-out";

  return {
    state,
    me: state === "ready" ? me.data! : null,
    meError: me.error as Error | null,
    refetch: me.refetch,
    passkey,
    walletSignIn,
    signOut,
    forgetPasskey,
  };
}
