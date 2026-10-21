"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, formatChog, type TierFacts } from "@/lib/api";
import { useHeroCtaRef } from "@/lib/heroCta";
import type { useSession } from "@/lib/useSession";
import { Mascot, type Mood } from "./Mascot";
import { Faq } from "./Faq";
import { ChogReel } from "./ChogReel";
import { SignIn } from "./SignIn";
import { buttonClass, Container } from "./ui";

export function Landing({ session }: { session: ReturnType<typeof useSession> }) {
  const tiers = useQuery<TierFacts>({ queryKey: ["tiers"], queryFn: () => api<TierFacts>("/api/tiers") });
  return (
    <main>
      <Hero session={session} />
      <ChogReel />
      <HowItWorks clipSeconds={tiers.data?.clipSeconds ?? null} />
      <Compare tiers={tiers.data} />
      <section id="faq" className="scroll-mt-16">
        <Container className="py-16 sm:py-24">
          <Faq />
        </Container>
      </section>
    </main>
  );
}

/** Camcorder viewfinder corners around the headline. */
function Viewfinder({ children }: { children: React.ReactNode }) {
  const corner = "pointer-events-none absolute size-7 border-brand sm:size-10";
  return (
    <div className="relative px-5 py-8 sm:px-10 sm:py-12">
      <span aria-hidden className={`${corner} left-0 top-0 rounded-tl-2xl border-l-[3px] border-t-[3px]`} />
      <span aria-hidden className={`${corner} right-0 top-0 rounded-tr-2xl border-r-[3px] border-t-[3px]`} />
      <span aria-hidden className={`${corner} bottom-0 left-0 rounded-bl-2xl border-b-[3px] border-l-[3px]`} />
      <span aria-hidden className={`${corner} bottom-0 right-0 rounded-br-2xl border-b-[3px] border-r-[3px]`} />
      {children}
    </div>
  );
}

function Hero({ session }: { session: ReturnType<typeof useSession> }) {
  const ctaRef = useHeroCtaRef<HTMLDivElement>();
  return (
    <section className="border-b border-line">
      <Container className="grid items-center gap-6 py-10 sm:py-16 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-6 md:py-24">
        <Mascot mood="idle" size={320} className="h-auto w-32 sm:w-44 md:w-full" />
        <Viewfinder>
          <p className="flex items-center gap-2 text-sm font-semibold text-brand">
            <span aria-hidden className="size-2.5 animate-pulse rounded-full bg-brand motion-reduce:animate-none" />
            REC
          </p>
          <h1 className="mt-4 font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-[64px] lg:text-[80px]">
            Your Chog,
            <br />
            in motion.
          </h1>
          <p className="mt-5 max-w-[34rem] text-[17px] leading-relaxed text-mute sm:text-lg">
            Upload an image and describe a scene. Dubu turns it into a short video you can download. Chog Genesis
            holders get their own Chog loaded in, sharper video and no watermark.
          </p>
          <div ref={ctaRef} id="sign-in" className="mt-8 scroll-mt-24">
            {session.state === "ready" && session.me ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Link href="/studio" className={`${buttonClass("primary", "lg")} w-full sm:w-auto`}>
                  Open the studio
                </Link>
                <Link href="/profile" className={`${buttonClass("ghost", "lg")} w-full sm:w-auto`}>
                  Profile
                </Link>
              </div>
            ) : (
              <SignIn session={session} />
            )}
          </div>
        </Viewfinder>
      </Container>
    </section>
  );
}

function HowItWorks({ clipSeconds }: { clipSeconds: number | null }) {
  const steps: { mood: Mood; title: string; body: string }[] = [
    {
      mood: "idle",
      title: "Sign in",
      body: "Use a passkey for a free Dubu wallet, or connect a wallet. Dubu checks your linked wallets for a Chog Genesis NFT and CHOG.",
    },
    {
      mood: "rolling",
      title: "Describe a scene",
      body: "Write one sentence, like “dancing in the rain”. Without a Chog, upload any image first.",
    },
    {
      mood: "done",
      title: "Download your video",
      body: `Watch it in the browser, then save it to your phone.${clipSeconds ? ` Each clip runs about ${clipSeconds} seconds.` : ""}`,
    },
  ];

  return (
    <section id="how-it-works" className="scroll-mt-16">
      <Container className="py-16 sm:py-24">
        <h2 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[44px]">
          How it works
        </h2>
        <ol className="mt-10 grid gap-10 sm:mt-14 md:grid-cols-3 md:gap-8">
          {steps.map((s) => (
            <li key={s.title} className="flex gap-5 md:flex-col md:gap-4">
              <Mascot mood={s.mood} size={120} className="h-auto w-20 shrink-0 sm:w-24 md:w-28" />
              <div>
                <h3 className="font-display text-[22px] font-bold tracking-[-0.02em]">{s.title}</h3>
                <p className="mt-2 max-w-[22rem] leading-relaxed text-mute">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

function Compare({ tiers }: { tiers?: TierFacts }) {
  const v = (s?: string | number) => (s === undefined ? "-" : String(s));
  const mark = (w?: boolean) => (w === undefined ? "-" : w ? "Small Dubu mark" : "None");
  const tokenOn = !!tiers?.chogMin;

  const genesisRows: [string, string][] = [
    ["Unlocks with", "Chog Genesis NFT"],
    ["Image", "Your own Chog"],
    ["Prompt", "Uses its traits"],
    ["Video size", v(tiers?.holder.quality)],
    ["Videos per day", v(tiers?.holder.limit)],
    ["Watermark", mark(tiers?.holder.watermark)],
  ];
  const tokenRows: [string, string][] = [
    ["Unlocks with", tiers?.chogMin ? `${formatChog(tiers.chogMin)} CHOG` : "-"],
    ["Image", "Any image you upload"],
    ["Prompt", "Your words only"],
    ["Video size", v(tiers?.token.quality)],
    ["Videos per day", v(tiers?.token.limit)],
    ["Watermark", mark(tiers?.token.watermark)],
  ];
  const freeRows: [string, string][] = [
    ["Unlocks with", "Signing in"],
    ["Image", "Any image you upload"],
    ["Prompt", "Your words only"],
    ["Video size", v(tiers?.free.quality)],
    ["Videos per day", v(tiers?.free.limit)],
    ["Watermark", mark(tiers?.free.watermark)],
  ];

  return (
    <section id="holders" className="scroll-mt-16 bg-surface">
      <Container className="py-16 sm:py-24">
        <h2 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[44px]">
          Holders get the full studio
        </h2>
        <p className="mt-3 max-w-[38rem] text-lg leading-relaxed text-mute">
          {tokenOn
            ? "Dubu checks every wallet you link for a Chog Genesis NFT and your CHOG balance, then picks your level. Everyone else can still make videos for free."
            : "Dubu checks every wallet you link for a Chog Genesis NFT. Holders get the full studio. Everyone else can still make videos for free."}
        </p>
        <div className={`mt-10 grid gap-4 md:gap-5 ${tokenOn ? "lg:grid-cols-3" : "md:grid-cols-2"}`}>
          <TierColumn title="Genesis holder" rows={genesisRows} featured />
          {tokenOn && <TierColumn title="CHOG holder" rows={tokenRows} />}
          <TierColumn title="Free" rows={freeRows} />
        </div>
      </Container>
    </section>
  );
}

function TierColumn({ title, rows, featured }: { title: string; rows: [string, string][]; featured?: boolean }) {
  return (
    <div className={`rounded-3xl p-6 sm:p-8 ${featured ? "bg-brand text-white" : "border border-line bg-white"}`}>
      <h3 className="font-display text-2xl font-bold tracking-[-0.02em]">{title}</h3>
      <dl className="mt-6">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className={`flex items-baseline justify-between gap-4 border-t py-3.5 ${featured ? "border-white/25" : "border-line"}`}
          >
            <dt className={`whitespace-nowrap ${featured ? "text-white/80" : "text-mute"}`}>{label}</dt>
            <dd className="text-right font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
