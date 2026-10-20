"use client";

import { useEffect, useRef } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, type Me } from "./api";

/**
 * Wallet session state:
 * disconnected -> needs-signature -> checking -> ready | error
 */
export function useSession() {
  const { address, isConnected, status: accountStatus } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const qc = useQueryClient();

  const me = useQuery<Me | null>({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api<Me>("/api/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    enabled: isConnected,
    retry: false,
    staleTime: 30_000,
  });

  // Signed session belongs to a different wallet than the connected one: drop it.
  const mismatch = !!(me.data && address && me.data.address !== address.toLowerCase());
  const lastAddress = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (lastAddress.current && lastAddress.current !== address) {
      api("/api/auth/logout", { method: "POST" }).finally(() => qc.setQueryData(["me"], null));
    }
    lastAddress.current = address;
  }, [address, qc]);

  const signIn = useMutation({
    mutationFn: async () => {
      if (!address) throw new Error("Connect a wallet first.");
      const { message } = await api<{ message: string }>(`/api/auth/nonce?address=${address}`);
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch {
        throw new Error("Signature cancelled. Sign the message to continue.");
      }
      await api("/api/auth/verify", { method: "POST", body: JSON.stringify({ address, signature }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me"] }),
  });

  let state: "connecting" | "disconnected" | "needs-signature" | "checking" | "ready" | "error";
  if (accountStatus === "connecting" || accountStatus === "reconnecting") state = "connecting";
  else if (!isConnected) state = "disconnected";
  else if (me.isPending) state = "checking";
  else if (me.isError) state = "error";
  else if (!me.data || mismatch) state = "needs-signature";
  else state = "ready";

  return {
    state,
    me: state === "ready" ? me.data! : null,
    meError: me.error as Error | null,
    refetch: me.refetch,
    signIn,
  };
}
