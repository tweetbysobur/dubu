"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useMe } from "@/lib/useSession";
import { rememberedPasskey } from "@/lib/passkey";
import { Alert, Button, Container, Panel, Spinner, buttonClass } from "@/components/ui";
import { Mascot } from "@/components/Mascot";

const MAX_LINKED = 3;

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Holder status can be confirmed even when the Chogs themselves cannot be listed. */
function chogLabel(n: number, holder: boolean) {
  if (n === 0) return holder ? "Holds a Chog" : "No Chog";
  return n === 1 ? "1 Chog" : `${n} Chogs`;
}

export default function ProfilePage() {
  const me = useMe();

  if (me.isPending) {
    return (
      <Container className="max-w-3xl py-10 sm:py-14" aria-busy>
        <div className="skeleton h-12 w-48 rounded-2xl" />
        <div className="skeleton mt-8 h-48 rounded-3xl" />
        <div className="skeleton mt-6 h-64 rounded-3xl" />
      </Container>
    );
  }

  if (!me.data) {
    return (
      <Container className="flex justify-center py-14 sm:py-24">
        <div className="w-full max-w-md text-center sm:text-left">
          <Mascot mood="idle" size={120} className="mx-auto h-auto w-24 sm:mx-0 sm:w-28" />
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Sign in to see your profile</h1>
          <p className="mt-3 leading-relaxed text-mute">Your profile shows your Dubu wallet and the wallets you link to it.</p>
          <Link href="/#sign-in" className={`${buttonClass("primary", "lg")} mt-7 w-full sm:w-auto`}>
            Sign in
          </Link>
        </div>
      </Container>
    );
  }

  return <Profile me={me.data} />;
}

function Profile({ me }: { me: NonNullable<ReturnType<typeof useMe>["data"]> }) {
  const [main, ...linked] = me.wallets;
  const [isPasskey, setIsPasskey] = useState(false);
  useEffect(() => {
    setIsPasskey(rememberedPasskey()?.address.toLowerCase() === me.address.toLowerCase());
  }, [me.address]);

  const holderSource = me.wallets.find((w) => w.holder);
  const remaining = Math.max(0, me.limit - me.used);

  return (
    <main>
      <Container className="max-w-3xl py-8 sm:py-12">
        <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Profile</h1>

        <Panel className="mt-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
                {isPasskey ? "Your passkey wallet" : "Your sign-in wallet"}
              </h2>
              <p className="mt-1 text-sm text-mute">
                {isPasskey ? "Made with a passkey on this device. Dubu never sees its key." : "The wallet you signed in with."}
              </p>
            </div>
            <span className="text-sm text-mute">{chogLabel(main?.chogs ?? 0, main?.holder ?? false)}</span>
          </div>
          <p className="mt-4 break-all rounded-2xl bg-surface px-4 py-3 text-[15px] font-medium tabular-nums">{me.address}</p>

          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-mute">Mode</dt>
              <dd className="mt-1 flex items-center gap-2 font-semibold">
                <span aria-hidden className={`size-2 rounded-full ${me.tier === "holder" ? "bg-brand" : "bg-mute"}`} />
                {me.tier === "holder" ? "Holder mode" : "Free mode"}
              </dd>
              <dd className="mt-1 text-sm text-mute">
                {me.tier === "holder" && holderSource
                  ? holderSource.address === me.address.toLowerCase()
                    ? "Your Chog is in this wallet."
                    : `From the Chog in ${short(holderSource.address)}.`
                  : "Link a wallet that holds a Chog to unlock holder mode."}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-mute">Videos left today</dt>
              <dd className="mt-1 font-semibold tabular-nums">
                {remaining} of {me.limit}
              </dd>
            </div>
          </dl>
        </Panel>

        <LinkedWallets linked={linked} account={me.address} />
      </Container>
    </main>
  );
}

function LinkedWallets({ linked, account }: { linked: { address: string; chogs: number; holder: boolean }[]; account: string }) {
  const qc = useQueryClient();
  const { address: connected, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [notice, setNotice] = useState<string | null>(null);
  const wantLink = useRef(false);

  const link = useMutation({
    mutationFn: async (wallet: string) => {
      if (wallet.toLowerCase() === account.toLowerCase()) {
        throw new Error("That is the wallet you signed in with. Switch to another wallet to link it.");
      }
      const { message } = await api<{ message: string }>(`/api/links/nonce?address=${wallet}`);
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch {
        throw new Error("The signature was cancelled. Nothing was linked.");
      }
      await api("/api/links", { method: "POST", body: JSON.stringify({ address: wallet, signature }) });
      return wallet;
    },
    onSuccess: (wallet) => {
      setNotice(`Linked ${short(wallet)}.`);
      qc.invalidateQueries({ queryKey: ["me"] });
      disconnect(); // the passkey session stays; the wallet was only needed to sign
    },
    onSettled: () => {
      wantLink.current = false;
    },
  });

  const unlink = useMutation({
    mutationFn: (wallet: string) => api("/api/links", { method: "DELETE", body: JSON.stringify({ address: wallet }) }),
    onSuccess: (_d, wallet) => {
      setNotice(`Unlinked ${short(wallet)}.`);
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  // After the connect modal closes with a wallet, go straight to the link signature.
  useEffect(() => {
    if (wantLink.current && isConnected && connected && !link.isPending) {
      wantLink.current = false;
      link.mutate(connected);
    }
  }, [isConnected, connected, link]);

  function start() {
    setNotice(null);
    link.reset();
    if (isConnected && connected) {
      link.mutate(connected);
    } else {
      wantLink.current = true;
      openConnectModal?.();
    }
  }

  const full = linked.length >= MAX_LINKED;

  return (
    <Panel className="mt-6">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Linked wallets</h2>
      <p className="mt-1 max-w-[36rem] text-sm leading-relaxed text-mute">
        Link the wallet that holds your Chog to use holder mode here. You sign one message to prove the wallet is yours.
        Nothing moves and there is no gas.
      </p>

      {linked.length > 0 ? (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {linked.map((w) => (
            <li key={w.address} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
              <div className="min-w-0">
                <p className="font-semibold tabular-nums">{short(w.address)}</p>
                <p className="text-sm text-mute">{chogLabel(w.chogs, w.holder)}</p>
              </div>
              <Button
                variant="ghost"
                loading={unlink.isPending && unlink.variables === w.address}
                disabled={unlink.isPending}
                onClick={() => unlink.mutate(w.address)}
              >
                Unlink
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-mute">
          No linked wallets yet.
        </p>
      )}

      <div className="mt-5">
        <Button size="lg" className="w-full sm:w-auto" disabled={full || link.isPending} onClick={start}>
          {link.isPending ? (
            <>
              <Spinner /> Confirm in your wallet
            </>
          ) : (
            "Link a wallet"
          )}
        </Button>
        {full && <p className="mt-2 text-sm text-mute">You can link up to {MAX_LINKED} wallets. Unlink one to add another.</p>}
      </div>

      {(link.error || unlink.error) && (
        <div className="mt-4">
          <Alert>{(link.error ?? unlink.error)!.message}</Alert>
        </div>
      )}
      {notice && !link.error && (
        <div className="mt-4">
          <Alert tone="info">{notice}</Alert>
        </div>
      )}
    </Panel>
  );
}
