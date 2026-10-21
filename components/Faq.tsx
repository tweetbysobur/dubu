"use client";

import { useQuery } from "@tanstack/react-query";
import { api, formatChog, type TierFacts } from "@/lib/api";

function items(t?: TierFacts): { q: string; a: string }[] {
  const free = t ? String(t.free.limit) : "a few";
  const unlock = t?.chogMin ? `A Chog Genesis NFT or ${formatChog(t.chogMin)} CHOG` : "A Chog Genesis NFT";

  return [
    {
      q: "What is Dubu?",
      a: "Dubu turns one image and one sentence into a short video. Chog holders get more.",
    },
    {
      q: "Do I need a Chog?",
      a: `No. Anyone gets ${free} free videos a day. ${unlock} unlocks more.`,
    },
    {
      q: "What is a passkey wallet?",
      a: "A wallet made with Face ID or your fingerprint. Nothing to install, and Dubu never sees its key.",
    },
    {
      q: "My Chog is in another wallet. What do I do?",
      a: "Link that wallet in Profile. Dubu counts everything your linked wallets hold.",
    },
    {
      q: "Can I back up my passkey wallet?",
      a: "Yes. Export wallet in Profile shows your recovery phrase. Keep it offline, or import it into MetaMask.",
    },
    {
      q: "Does it cost gas?",
      a: "No. You only sign messages. Nothing moves.",
    },
  ];
}

export function Faq({ headingLevel = "h2" }: { headingLevel?: "h1" | "h2" }) {
  const tiers = useQuery<TierFacts>({ queryKey: ["tiers"], queryFn: () => api<TierFacts>("/api/tiers") });
  const Heading = headingLevel;
  return (
    <div>
      <Heading className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[44px]">
        Questions
      </Heading>
      <div className="mt-8 divide-y divide-line border-y border-line sm:mt-10">
        {items(tiers.data).map((item) => (
          <details key={item.q} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-6 py-4 text-left text-[17px] font-semibold marker:hidden sm:text-lg [&::-webkit-details-marker]:hidden">
              {item.q}
              <svg
                aria-hidden
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="shrink-0 text-mute transition-transform group-open:rotate-45 motion-reduce:transition-none"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </summary>
            <p className="max-w-[44rem] pb-5 leading-relaxed text-mute">{item.a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
