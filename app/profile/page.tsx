"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAccount, useDisconnect, useSignMessage } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, formatChog, formatMon, TIER_NAME, type Me } from "@/lib/api";
import { useMe } from "@/lib/useSession";
import { memoryFor } from "@/lib/passkey";
import { Alert, Button, Container, Panel, Spinner, buttonClass } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { ExportWallet } from "@/components/ExportWallet";
import { TokenIdLoader } from "@/components/TokenIdLoader";
import { TokenIcon } from "@/components/TokenIcon";
import { WalletGlyph } from "@/components/WalletGlyphs";
import { ChogFrame } from "@/components/ChogFrame";
import { LevelBadge, LevelMark } from "@/components/LevelBadge";
import { notify } from "@/lib/notify";

const MAX_LINKED = 3;

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/** Holder status can be confirmed even when the NFTs themselves cannot be listed. */
function chogLabel(n: number, holder: boolean) {
  if (n === 0) return holder ? "Holds a Chog Genesis" : "No Chog Genesis";
  return n === 1 ? "1 Chog Genesis" : `${n} Chog Genesis`;
}

/** What a wallet holds: Chog Genesis NFTs, and CHOG when balances are tracked. */
function Holdings({ chogs, holder, balance, tracked }: { chogs: number; holder: boolean; balance?: string; tracked: boolean }) {
  return (
    <p className="flex flex-wrap gap-x-3 text-sm text-mute tabular-nums">
      <span>{chogLabel(chogs, holder)}</span>
      {tracked && <span>{formatChog(balance)} CHOG</span>}
    </p>
  );
}

function levelReason(me: Me, nftWallet?: string): string {
  if (me.tier === "holder") {
    return nftWallet && nftWallet !== me.address.toLowerCase()
      ? `From the Chog Genesis in ${short(nftWallet)}. Your Chog loads into the studio.`
      : "Your Chog Genesis is in this wallet. It loads into the studio.";
  }
  if (me.tier === "token") {
    return `You hold ${formatChog(me.chog.balance)} CHOG across your wallets. Add a Chog Genesis NFT for the full studio.`;
  }
  return me.chog.min
    ? `Hold ${formatChog(me.chog.min)} CHOG or a Chog Genesis NFT across your wallets to level up.`
    : "Link a wallet that holds a Chog Genesis NFT to become a Genesis holder.";
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

function Profile({ me }: { me: Me }) {
  const linked = me.wallets.slice(1);
  const [isPasskey, setIsPasskey] = useState(false);
  useEffect(() => {
    setIsPasskey(!!memoryFor(me.address));
  }, [me.address]);

  const holderSource = me.wallets.find((w) => w.holder);

  return (
    <main>
      <Container className="max-w-3xl py-8 sm:py-12">
        <div className="flex items-center gap-4">
          <Avatar me={me} />
          <div className="min-w-0">
            <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Profile</h1>
            <LevelBadge tier={me.tier} size="sm" className="mt-1.5" />
          </div>
        </div>

        <WalletCard me={me} isPasskey={isPasskey} />
        <LevelCard me={me} nftWallet={holderSource?.address} />
        <MyChogs me={me} />

        <LinkedWallets linked={linked} account={me.address} tracked={me.chog.tracked} tier={me.tier} />

        {isPasskey && <ExportWallet address={me.address} />}
      </Container>
    </main>
  );
}

/** A Genesis holder's own Chog as their picture, else the Dubu mascot. */
function Avatar({ me }: { me: Me }) {
  const [failed, setFailed] = useState(false);
  const chog = me.tokens[0];
  if (chog && !failed) {
    return (
      <ChogFrame
        tokenId={chog.tokenId}
        src={`/api/chogs/${chog.tokenId}/image`}
        alt={chog.name}
        size="xs"
        className="size-16 shrink-0 ring-1 ring-line sm:size-20"
        onError={() => setFailed(true)}
      />
    );
  }
  return (
    <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-wash sm:size-20">
      <Mascot mood="idle" size={64} className="h-auto w-12 sm:w-14" />
    </span>
  );
}

function Icon({ d }: { d: string }) {
  return (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** The wallet at a glance: address, balances with their marks, and the actions that move money in and out. */
function WalletCard({ me, isPasskey }: { me: Me; isPasskey: boolean }) {
  const [copied, setCopied] = useState(false);
  const mon = me.mon.balance;
  const funded = mon !== null && Number(mon) > 0;
  const chog = me.wallets[0]?.chogBalance ?? "0";

  async function copy() {
    try {
      await navigator.clipboard.writeText(me.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the address is on the Deposit page to select by hand.
    }
  }

  const action = "inline-flex h-12 flex-1 sm:flex-none sm:px-8 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition-colors";

  return (
    <section aria-label="Wallet" className="mt-8 overflow-hidden rounded-3xl bg-brand text-white">
      <div className="p-5 sm:p-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white/90">{isPasskey ? "Passkey wallet" : "Sign-in wallet"} · Monad</p>
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-press px-3 text-sm font-semibold tabular-nums hover:bg-ink/40"
            aria-label={copied ? "Address copied" : `Copy address ${me.address}`}
          >
            {copied ? "Copied" : short(me.address)}
            {!copied && <Icon d="M9 9h10v10H9zM5 15V5h10" />}
          </button>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <TokenIcon token="mon" size={40} className="ring-2 ring-white/30" />
          <p className="font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums sm:text-[56px]">
            {mon === null ? "-" : formatMon(mon)}
            <span className="ml-2 text-2xl font-bold tracking-[-0.02em] text-white/90 sm:text-3xl">MON</span>
          </p>
        </div>
        {me.chog.tracked && (
          <p className="mt-3 flex items-center gap-2 text-[15px] font-semibold tabular-nums text-white/90">
            <TokenIcon token="chog" size={22} />
            {formatChog(chog)} CHOG
            {me.wallets.length > 1 && (
              <span className="font-medium text-white/90">· {formatChog(me.chog.balance)} across all wallets</span>
            )}
          </p>
        )}
        {!funded && mon !== null && (
          <p className="mt-4 text-sm leading-relaxed text-white/90">Add MON to buy CHOG and pay network fees.</p>
        )}
      </div>

      <div className="flex gap-2 bg-brand-press/60 p-3 sm:p-4">
        <Link href="/deposit" className={`${action} bg-white text-brand hover:bg-wash`}>
          <WalletGlyph name="deposit" />
          Deposit
        </Link>
        {me.swap && (
          <Link href="/swap" className={`${action} bg-white/15 text-white hover:bg-white/25`}>
            <WalletGlyph name="swap" />
            Swap
          </Link>
        )}
        {me.withdraw.open && (
          <Link href="/withdraw" className={`${action} bg-white/15 text-white hover:bg-white/25`}>
            <WalletGlyph name="withdraw" />
            Withdraw
          </Link>
        )}
      </div>
    </section>
  );
}

/**
 * Every Chog Genesis across the account's wallets, each one a tap away from
 * the studio. If a wallet holds a Chog that cannot be listed, the holder adds
 * it once by number and Dubu remembers it (re-checked onchain every time).
 */
function MyChogs({ me }: { me: Me }) {
  const qc = useQueryClient();
  const holderWallets = me.wallets.filter((w) => w.holder);
  const [adding, setAdding] = useState(false);
  const missing = holderWallets.length > 0 && me.tokens.length === 0;

  return (
    <section id="chogs" aria-label="Your Chog Genesis" className="scroll-mt-24">
      <Panel className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Your Chog Genesis</h2>
            <p className="mt-1 text-sm text-mute">
              {me.tokens.length
                ? "Pick one and it goes straight into the studio."
                : holderWallets.length
                  ? "Your wallet holds a Chog Genesis. Add it once by its number and it stays here."
                  : "Link the wallet that holds your Chog Genesis and it shows up here, ready for the studio."}
            </p>
          </div>
        </div>

        {me.tokens.length > 0 && (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {me.tokens.map((t) => (
              <li key={t.tokenId}>
                <Link
                  href={`/studio?chog=${encodeURIComponent(t.tokenId)}`}
                  className="group block rounded-3xl focus-visible:outline-2"
                  aria-label={`Make a video with ${t.name}`}
                >
                  <ChogTile tokenId={t.tokenId} image={t.image} alt={t.name} />
                  <p className="mt-2 truncate font-semibold">{t.name}</p>
                  <p className="flex items-center justify-between gap-2 text-sm text-mute">
                    <span className="truncate tabular-nums">{t.owner ? `In ${short(t.owner)}` : ""}</span>
                    <span className="shrink-0 font-semibold text-brand group-hover:text-brand-press">Make a video</span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {holderWallets.length === 0 ? (
          <a href="#linked" className={`${buttonClass("ghost")} mt-5`}>
            Link a wallet
          </a>
        ) : missing || adding ? (
          <div className="mt-5 rounded-2xl bg-surface p-4">
            <TokenIdLoader
              onLoaded={() => {
                setAdding(false);
                qc.invalidateQueries({ queryKey: ["me"] });
              }}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="mt-4 inline-flex h-11 items-center text-sm font-semibold text-brand hover:text-brand-press"
          >
            Missing one? Add it by number
          </button>
        )}
      </Panel>
    </section>
  );
}

/** Dubu's image route first; the token's own image if that route cannot load it. */
function ChogTile({ tokenId, image, alt }: { tokenId: string; image: string; alt: string }) {
  const [direct, setDirect] = useState(false);
  return (
    <ChogFrame
      tokenId={tokenId}
      src={direct && image ? image : `/api/chogs/${tokenId}/image`}
      alt={alt}
      onError={() => setDirect(true)}
    />
  );
}

/** Level, what unlocks the next one, and today's videos. */
function LevelCard({ me, nftWallet }: { me: Me; nftWallet?: string }) {
  const remaining = Math.max(0, me.limit - me.used);
  const min = me.chog.min ? Number(me.chog.min) : null;
  const have = Number(me.chog.balance);
  const progress = me.tier === "free" && min ? Math.min(1, have / min) : null;

  return (
    <Panel className="mt-4">
      <div className="grid gap-6 sm:grid-cols-[1fr_auto] sm:items-start">
        <div className="min-w-0">
          <p className="text-sm text-mute">Level</p>
          <LevelBadge tier={me.tier} size="lg" className="mt-2" />
          <p className="mt-3 max-w-[30rem] text-sm leading-relaxed text-mute">{levelReason(me, nftWallet)}</p>
          {progress !== null && (
            <div className="mt-4 max-w-[30rem]">
              <div
                className="h-2 overflow-hidden rounded-full bg-surface"
                role="progressbar"
                aria-label="Progress to CHOG holder"
                aria-valuemin={0}
                aria-valuemax={min!}
                aria-valuenow={Math.min(have, min!)}
              >
                <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(progress * 100, have > 0 ? 2 : 0)}%` }} />
              </div>
              <p className="mt-2 text-sm font-medium tabular-nums">
                {formatChog(me.chog.balance)} <span className="text-mute">of {formatChog(me.chog.min)} CHOG</span>
              </p>
            </div>
          )}
        </div>
        <div className="rounded-2xl bg-surface px-5 py-4 sm:min-w-40 sm:text-right">
          <p className="text-sm text-mute">Videos left today</p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">
            {remaining}
            <span className="text-base font-semibold text-mute"> of {me.limit}</span>
          </p>
        </div>
      </div>
    </Panel>
  );
}

function LinkedWallets({
  linked,
  account,
  tracked,
  tier,
}: {
  linked: { address: string; chogs: number; holder: boolean; chogBalance: string }[];
  account: string;
  tracked: boolean;
  tier: Me["tier"];
}) {
  const qc = useQueryClient();
  const { address: connected, isConnected } = useAccount();
  const { openConnectModal, connectModalOpen } = useConnectModal();
  const { signMessageAsync } = useSignMessage();
  const { disconnect } = useDisconnect();
  const [phase, setPhase] = useState<"connect" | "sign" | null>(null);
  const wantLink = useRef(false);

  const link = useMutation({
    mutationFn: async (wallet: string) => {
      if (wallet.toLowerCase() === account.toLowerCase()) {
        throw new Error("That is the wallet you signed in with. Switch to another wallet to link it.");
      }
      setPhase("sign");
      const { message } = await api<{ message: string }>(`/api/links/nonce?address=${wallet}`);
      let signature: string;
      try {
        signature = await signMessageAsync({ message });
      } catch {
        throw new Error("The signature was cancelled. Nothing was linked.");
      }
      await api("/api/links", { method: "POST", body: JSON.stringify({ address: wallet, signature }) });
      return { wallet, me: await api<Me>("/api/me") };
    },
    onSuccess: ({ wallet, me }) => {
      qc.setQueryData(["me"], me);
      const upgraded = me.tier !== tier && me.tier !== "free";
      notify({
        tone: "celebrate",
        title: upgraded ? `${TIER_NAME[me.tier]} unlocked` : "Wallet linked",
        body: upgraded
          ? `${short(wallet.toLowerCase())} is linked. Your level is now ${TIER_NAME[me.tier]}.`
          : `${short(wallet.toLowerCase())} now counts toward your level.`,
        ...(me.tokens.length ? { action: { label: "See your Chogs", href: "/profile#chogs" } } : {}),
      });
      disconnect(); // the passkey session stays; the wallet was only needed to sign
    },
    onError: () => {
      // Never leave the other wallet connected: it is only here to sign the link message.
      disconnect();
    },
    onSettled: () => {
      wantLink.current = false;
      setPhase(null);
    },
  });

  const unlink = useMutation({
    mutationFn: (wallet: string) => api("/api/links", { method: "DELETE", body: JSON.stringify({ address: wallet }) }),
    onSuccess: (_d, wallet) => {
      notify({ tone: "info", title: "Wallet unlinked", body: `${short(wallet)} no longer counts toward your level.` });
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

  // The modal closed without a wallet: back to the start.
  useEffect(() => {
    if (!connectModalOpen && phase === "connect" && !isConnected) {
      const t = setTimeout(() => {
        if (wantLink.current) {
          wantLink.current = false;
          setPhase(null);
        }
      }, 400);
      return () => clearTimeout(t);
    }
  }, [connectModalOpen, phase, isConnected]);

  function start() {
    link.reset();
    if (isConnected && connected) {
      link.mutate(connected);
    } else {
      wantLink.current = true;
      setPhase("connect");
      openConnectModal?.();
    }
  }

  const full = linked.length >= MAX_LINKED;
  const steps: { key: "connect" | "sign" | "done"; label: string }[] = [
    { key: "connect", label: "Connect the wallet" },
    { key: "sign", label: "Sign one message" },
    { key: "done", label: "It counts toward your level" },
  ];
  const activeIndex = phase === "connect" ? 0 : phase === "sign" ? 1 : -1;

  return (
    <Panel className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 id="linked" className="scroll-mt-24 font-display text-xl font-bold tracking-[-0.02em]">Linked wallets</h2>
          <p className="mt-1 max-w-[34rem] text-sm leading-relaxed text-mute">
            Hold your Chog Genesis or CHOG in another wallet? Link it and Dubu counts it toward your level. You stay
            signed in with this account. Nothing moves and there is no gas.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-surface px-3 py-1 text-sm font-semibold tabular-nums text-mute">
          {linked.length} of {MAX_LINKED}
        </span>
      </div>

      {linked.length > 0 && (
        <ul className="mt-5 space-y-2">
          {linked.map((w) => {
            const chog = Number(w.chogBalance) > 0;
            return (
              <li key={w.address} className="flex items-center gap-3 rounded-2xl border border-line p-3 sm:p-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface">
                  {w.holder ? (
                    <LevelMark tier="holder" size={28} />
                  ) : chog ? (
                    <TokenIcon token="chog" size={28} />
                  ) : (
                    <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4A5568" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 12h.01M4 9h16" />
                    </svg>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">{short(w.address)}</p>
                  <Holdings chogs={w.chogs} holder={w.holder} balance={w.chogBalance} tracked={tracked} />
                </div>
                <Button
                  variant="ghost"
                  loading={unlink.isPending && unlink.variables === w.address}
                  disabled={unlink.isPending}
                  onClick={() => unlink.mutate(w.address)}
                  aria-label={`Unlink ${short(w.address)}`}
                >
                  Unlink
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <ol className="mt-5 grid gap-2 sm:grid-cols-3" aria-label="How linking works">
        {steps.map((st, i) => {
          const active = i === activeIndex;
          const doneStep = activeIndex > i;
          return (
            <li
              key={st.key}
              aria-current={active ? "step" : undefined}
              className={`flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium ${active ? "bg-wash text-brand" : "bg-surface text-mute"}`}
            >
              <span
                className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold tabular-nums ${active || doneStep ? "bg-brand text-white" : "bg-white text-mute ring-1 ring-line"}`}
              >
                {active ? <Spinner className="size-3" /> : i + 1}
              </span>
              {st.label}
            </li>
          );
        })}
      </ol>

      <div className="mt-4">
        <Button size="lg" className="w-full sm:w-auto" disabled={full || link.isPending || phase === "connect"} onClick={start}>
          {link.isPending ? (
            <>
              <Spinner /> Confirm in your wallet
            </>
          ) : phase === "connect" ? (
            <>
              <Spinner /> Choose a wallet
            </>
          ) : linked.length ? (
            "Link another wallet"
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
    </Panel>
  );
}
