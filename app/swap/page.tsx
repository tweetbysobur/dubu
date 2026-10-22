"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatChog, formatMon, type Me } from "@/lib/api";
import { useMe } from "@/lib/useSession";
import { memoryFor } from "@/lib/passkey";
import { Container, Panel, buttonClass } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { Swap } from "@/components/Swap";
import { TokenIcon } from "@/components/TokenIcon";

export default function SwapPage() {
  const me = useMe({ refetchInterval: 15_000 });

  if (me.isPending) {
    return (
      <Container className="max-w-xl py-10 sm:py-14" aria-busy>
        <div className="skeleton h-10 w-40 rounded-2xl" />
        <div className="skeleton mt-8 h-[30rem] rounded-3xl" />
      </Container>
    );
  }

  if (!me.data) {
    return (
      <Container className="flex justify-center py-14 sm:py-24">
        <div className="w-full max-w-md text-center sm:text-left">
          <Mascot mood="idle" size={120} className="mx-auto h-auto w-24 sm:mx-0 sm:w-28" />
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Sign in to swap</h1>
          <p className="mt-3 leading-relaxed text-mute">Swaps happen in your Dubu wallet. Sign in to see it.</p>
          <Link href="/#sign-in" className={`${buttonClass("primary", "lg")} mt-7 w-full sm:w-auto`}>
            Sign in
          </Link>
        </div>
      </Container>
    );
  }

  return <SwapScreen me={me.data} />;
}

function SwapScreen({ me }: { me: Me }) {
  const [isPasskey, setIsPasskey] = useState(false);
  useEffect(() => setIsPasskey(!!memoryFor(me.address)), [me.address]);
  const chog = me.wallets[0]?.chogBalance ?? null;

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

        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Swap</h1>
        <p className="mt-2 leading-relaxed text-mute">
          Buy or sell CHOG with MON. Dubu compares Nad.fun and Uniswap and uses the better price. You confirm every swap.
        </p>

        <div className="mt-6 flex flex-wrap gap-2 text-[15px] font-semibold tabular-nums">
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5">
            <TokenIcon token="mon" size={20} />
            {me.mon.balance === null ? "-" : formatMon(me.mon.balance)} MON
          </span>
          <span className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-3.5">
            <TokenIcon token="chog" size={20} />
            {chog === null ? "-" : formatChog(chog)} CHOG
          </span>
        </div>

        {me.swap ? (
          <Swap address={me.address} monBalance={me.mon.balance} chogBalance={chog} isPasskey={isPasskey} />
        ) : (
          <Panel className="mt-6">
            <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Swap opens soon</h2>
            <p className="mt-2 leading-relaxed text-mute">
              Swapping inside Dubu is not open for everyone yet. You can still{" "}
              <Link href="/deposit" className="font-semibold text-brand hover:underline">
                deposit MON or CHOG
              </Link>
              .
            </p>
          </Panel>
        )}

        <p className="mt-4 text-sm leading-relaxed text-mute">
          Swaps use your Dubu wallet on Monad. CHOG in linked wallets stays there. Selling takes two confirmations: one to
          allow exactly that much CHOG, one for the sale.
        </p>
      </Container>
    </main>
  );
}
