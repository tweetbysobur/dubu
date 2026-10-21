"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { formatChog, formatMon, type Me } from "@/lib/api";
import { useMe } from "@/lib/useSession";
import { activeChain } from "@/lib/chain";
import { Alert, Button, Container, Panel, buttonClass } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { TokenIcon } from "@/components/TokenIcon";

export default function DepositPage() {
  // Polls while open, so a deposit shows up on its own.
  const me = useMe({ refetchInterval: 8_000 });

  if (me.isPending) {
    return (
      <Container className="max-w-xl py-10 sm:py-14" aria-busy>
        <div className="skeleton h-10 w-40 rounded-2xl" />
        <div className="skeleton mt-8 h-[28rem] rounded-3xl" />
      </Container>
    );
  }

  if (!me.data) {
    return (
      <Container className="flex justify-center py-14 sm:py-24">
        <div className="w-full max-w-md text-center sm:text-left">
          <Mascot mood="idle" size={120} className="mx-auto h-auto w-24 sm:mx-0 sm:w-28" />
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Sign in to deposit</h1>
          <p className="mt-3 leading-relaxed text-mute">Your deposit address is your Dubu wallet. Sign in to see it.</p>
          <Link href="/#sign-in" className={`${buttonClass("primary", "lg")} mt-7 w-full sm:w-auto`}>
            Sign in
          </Link>
        </div>
      </Container>
    );
  }

  return <Deposit me={me.data} />;
}

function Deposit({ me }: { me: Me }) {
  const [copied, setCopied] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [received, setReceived] = useState<string | null>(null);
  const start = useRef<{ mon: number; chog: number } | null>(null);

  useEffect(() => setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function"), []);

  // Compare against the balances when the page opened. Anything new is a deposit.
  const mon = me.mon.balance === null ? null : Number(me.mon.balance);
  const chog = Number(me.wallets[0]?.chogBalance ?? 0);
  useEffect(() => {
    if (mon === null) return;
    if (!start.current) {
      start.current = { mon, chog };
      return;
    }
    const parts: string[] = [];
    if (mon > start.current.mon) parts.push(`${formatMon(String(mon - start.current.mon))} MON`);
    if (chog > start.current.chog) parts.push(`${formatChog(String(chog - start.current.chog))} CHOG`);
    if (parts.length) setReceived(parts.join(" and "));
  }, [mon, chog]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(me.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the full address is on screen to select by hand.
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "My Dubu wallet on Monad", text: me.address });
    } catch {
      // Share sheet closed.
    }
  }

  return (
    <main>
      <Container className="max-w-xl py-8 sm:py-12">
        <Link
          href="/profile"
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-medium text-mute hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Profile
        </Link>

        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Deposit</h1>
        <p className="mt-2 leading-relaxed text-mute">Send MON or CHOG on Monad to your Dubu wallet.</p>

        {received && (
          <div className="mt-6">
            <Alert tone="info">Received {received}. It is in your wallet now.</Alert>
          </div>
        )}

        <Panel className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-semibold">
              <TokenIcon token="mon" size={18} />
              {activeChain.name} network
            </span>
            <span className="text-sm text-mute tabular-nums">Chain ID {activeChain.id}</span>
          </div>

          <div className="mt-6 flex justify-center">
            <div className="rounded-3xl border border-line bg-white p-4">
              <QRCodeSVG
                value={me.address}
                size={208}
                level="M"
                marginSize={0}
                fgColor="#0B1220"
                title={`QR code for ${me.address}`}
              />
            </div>
          </div>

          <p className="mt-6 text-center text-sm text-mute">Your wallet address</p>
          {/* Grouped in fours so it is easy to check against what the sender pastes. */}
          <p className="sr-only">{me.address}</p>
          <p aria-hidden className="mx-auto mt-2 flex max-w-[20rem] flex-wrap justify-center gap-x-2 gap-y-1 font-mono text-[15px] font-medium tabular-nums">
            <span className="text-brand">0x</span>
            {me.address.slice(2).match(/.{1,4}/g)!.map((g, i) => (
              <span key={i}>{g}</span>
            ))}
          </p>

          <div className={`mt-6 grid gap-2 ${canShare ? "grid-cols-2" : ""}`}>
            <Button size="lg" onClick={copy} aria-live="polite">
              {copied ? "Copied" : "Copy address"}
            </Button>
            {canShare && (
              <Button size="lg" variant="ghost" onClick={share}>
                Share
              </Button>
            )}
          </div>

          <div className="mt-6 rounded-2xl border border-danger/20 bg-danger-wash px-4 py-3 text-sm leading-relaxed text-ink">
            <span className="font-semibold">Monad only.</span> Sending from Ethereum, Base, BNB Chain or any other network
            can lose the funds. Dubu cannot recover them.
          </div>
        </Panel>

        <Panel className="mt-4">
          <h2 className="font-display text-lg font-bold tracking-[-0.02em]">What you can send</h2>
          <ul className="mt-3 divide-y divide-line">
            <li className="flex items-center gap-3 py-3">
              <TokenIcon token="mon" size={32} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">MON</p>
                <p className="text-sm text-mute">Pays network fees and buys CHOG</p>
              </div>
              <p className="font-semibold tabular-nums">{mon === null ? "-" : formatMon(String(mon))}</p>
            </li>
            <li className="flex items-center gap-3 py-3">
              <TokenIcon token="chog" size={32} />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">CHOG</p>
                <p className="text-sm text-mute">Counts toward your level</p>
              </div>
              <p className="font-semibold tabular-nums">{formatChog(String(chog))}</p>
            </li>
          </ul>
          <p className="mt-3 flex items-center gap-2 text-sm text-mute">
            <span aria-hidden className="size-2 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />
            Watching for deposits. Balances update here on their own.
          </p>
        </Panel>

        <Panel className="mt-4">
          <h2 className="font-display text-lg font-bold tracking-[-0.02em]">From an exchange or another wallet</h2>
          <ol className="mt-3 space-y-3">
            {[
              "Choose to withdraw or send MON.",
              "Pick Monad as the network.",
              "Paste your Dubu address and send.",
            ].map((step, i) => (
              <li key={step} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-wash text-sm font-bold text-brand tabular-nums">
                  {i + 1}
                </span>
                <span className="pt-0.5 leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm leading-relaxed text-mute">Monad confirms in about a second. Exchanges can take a few minutes to send.</p>
        </Panel>
      </Container>
    </main>
  );
}
