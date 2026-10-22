"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, formatChog, type TierFacts, type TierId } from "@/lib/api";
import { useHeroCtaRef } from "@/lib/heroCta";
import type { useSession } from "@/lib/useSession";
import { Mascot, type Mood } from "./Mascot";
import { Faq } from "./Faq";
import { ChogReel } from "./ChogReel";
import { ChogFrame, useTimecode } from "./ChogFrame";
import { LevelMark } from "./LevelBadge";
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

type Showcase = { enabled: boolean; ids: string[] };

/** Real Chog Genesis art, one take at a time, through Dubu's viewfinder. Falls back to the mascot. */
function HeroTakes() {
  const showcase = useQuery<Showcase>({ queryKey: ["showcase"], queryFn: () => api<Showcase>("/api/showcase"), staleTime: Infinity });
  const [broken, setBroken] = useState<Set<string>>(new Set());
  const [take, setTake] = useState(0);
  const ids = (showcase.data?.enabled ? showcase.data.ids : []).filter((id) => !broken.has(id));
  const id = ids.length ? ids[take % ids.length] : null;
  const frames = useTimecode(!!id, 0);

  // A new take every 4 seconds. Holds still for reduced motion.
  useEffect(() => {
    if (ids.length < 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setTake((n) => n + 1), 4000);
    return () => clearInterval(t);
  }, [ids.length]);

  if (!id) return <Mascot mood="idle" size={320} className="mx-auto h-auto w-40 sm:w-52 md:w-full" />;
  const next = ids[(take + 1) % ids.length];

  return (
    <figure className="relative mx-auto w-full max-w-[24rem] pl-12 sm:max-w-[28rem] sm:pl-16 md:max-w-none">
      <div key={id} className="dubu-cut">
        <ChogFrame
          tokenId={id}
          src={`/api/chogs/${id}/image`}
          alt={`Chog Genesis #${id}`}
          size="lg"
          frames={frames}
          onError={() => setBroken((b) => new Set(b).add(id))}
          className="shadow-[0_24px_60px_rgba(11,18,32,0.18)]"
        />
      </div>
      {/* Warm the next take so the cut is instant. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/api/chogs/${next}/image`} alt="" aria-hidden className="hidden" />
      {/* Dubu is the one filming. */}
      <Mascot mood="rolling" size={120} className="absolute left-0 top-[58%] h-auto w-20 -translate-y-1/2 sm:w-28" />
      <figcaption className="sr-only">Chog Genesis #{id}, filmed by Dubu</figcaption>
    </figure>
  );
}

function Hero({ session }: { session: ReturnType<typeof useSession> }) {
  const ctaRef = useHeroCtaRef<HTMLDivElement>();
  return (
    <section className="border-b border-line">
      <Container className="grid items-center gap-12 py-10 sm:py-16 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-14 md:py-20">
        <div>
          <h1 className="font-display text-[48px] font-extrabold leading-[0.92] tracking-[-0.05em] sm:text-[68px] lg:text-[84px]">
            Your Chog,
            <br />
            in motion.
          </h1>
          <p className="mt-6 max-w-[32rem] text-[17px] leading-relaxed text-mute sm:text-lg">
            Upload your Chog, say what it should do, and get a short video or GIF of exactly that. Chog Genesis holders get their own Chog loaded in,
            sharper video and no watermark. Everyone else can upload any image.
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
        </div>
        <HeroTakes />
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
      title: "Say what it does",
      body: "Upload your NFT or any image, then write what it should do, like “waves with its left paw, then dances in the rain”.",
    },
    {
      mood: "done",
      title: "Download the video or GIF",
      body: `Watch it in the browser, then save it as a video or a GIF.${clipSeconds ? ` Each clip runs about ${clipSeconds} seconds.` : ""}`,
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
    ["Unlocks with", "A Chog Genesis"],
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
          <TierColumn tier="holder" title="Genesis holder" rows={genesisRows} featured />
          {tokenOn && <TierColumn tier="token" title="CHOG holder" rows={tokenRows} />}
          <TierColumn tier="free" title="Free" rows={freeRows} />
        </div>
      </Container>
    </section>
  );
}

function TierColumn({ tier, title, rows, featured }: { tier: TierId; title: string; rows: [string, string][]; featured?: boolean }) {
  return (
    <div className={`rounded-3xl p-6 sm:p-8 ${featured ? "bg-brand text-white" : "border border-line bg-white"}`}>
      <h3 className="flex items-center gap-3 font-display text-2xl font-bold tracking-[-0.02em]">
        <LevelMark tier={tier} size={32} />
        {title}
      </h3>
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
