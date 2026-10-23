"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Me } from "@/lib/api";
import { useMe } from "@/lib/useSession";
import { memoryFor } from "@/lib/passkey";
import { Container, Panel, buttonClass } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { Withdraw } from "@/components/Withdraw";

export default function WithdrawPage() {
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
          <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">Sign in to withdraw</h1>
          <p className="mt-3 leading-relaxed text-mute">Withdrawals come out of your Dubu wallet. Sign in to see it.</p>
          <Link href="/#sign-in" className={`${buttonClass("primary", "lg")} mt-7 w-full sm:w-auto`}>
            Sign in
          </Link>
        </div>
      </Container>
    );
  }

  return <WithdrawScreen me={me.data} />;
}

function WithdrawScreen({ me }: { me: Me }) {
  const [isPasskey, setIsPasskey] = useState(false);
  useEffect(() => setIsPasskey(!!memoryFor(me.address)), [me.address]);

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

        <h1 className="mt-3 font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">Withdraw</h1>
        <p className="mt-2 leading-relaxed text-mute">
          Send MON{me.withdraw.chog ? " or CHOG" : ""} from your Dubu wallet to any Monad address. You confirm every withdrawal.
        </p>

        {me.withdraw.open ? (
          <Withdraw
            address={me.address as `0x${string}`}
            monBalance={me.mon.balance}
            chogBalance={me.withdraw.chog ? (me.wallets[0]?.chogBalance ?? null) : null}
            chogEnabled={me.withdraw.chog}
            isPasskey={isPasskey}
          />
        ) : (
          <Panel className="mt-6">
            <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Withdrawals are paused</h2>
            <p className="mt-2 leading-relaxed text-mute">
              Your funds stay in your wallet. {isPasskey ? "You can still export your wallet from Profile and use it anywhere." : "Your sign-in wallet can move them any time."}
            </p>
          </Panel>
        )}

        <p className="mt-4 text-sm leading-relaxed text-mute">
          Withdrawals use your sign-in wallet on Monad. Linked wallets are yours already, so move funds from them in their own app.
        </p>
      </Container>
    </main>
  );
}
