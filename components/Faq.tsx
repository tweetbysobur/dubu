"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type TierFacts } from "@/lib/api";

function items(t?: TierFacts): { q: string; a: string }[] {
  const free = t ? String(t.free.limit) : "a few";
  const length = t?.clipSeconds ? `About ${t.clipSeconds} seconds.` : "A few seconds.";
  const sizes = t ? ` Holder videos are ${t.holder.quality}. Free videos are ${t.free.quality}.` : "";
  return [
    {
      q: "What is Dubu?",
      a: "Dubu turns one image and one sentence into a short video. Chog Genesis holders get their own Chog loaded in, sharper video and no watermark.",
    },
    {
      q: "Do I need a Chog?",
      a: `No. Anyone can make ${free} videos a day in free mode by uploading an image. Holder mode needs a Chog Genesis NFT on Monad.`,
    },
    {
      q: "What is a passkey wallet?",
      a: "When you continue with a passkey, your phone or computer creates one with Face ID, a fingerprint or your screen lock. Dubu turns it into a wallet address on your device. Dubu never sees the key, and there is no seed phrase to write down.",
    },
    {
      q: "My Chog is in another wallet. How do I get holder mode?",
      a: "Open Profile and link that wallet. You sign one message with it to prove it is yours. You can also sign in with that wallet directly.",
    },
    {
      q: "Does Dubu cost gas or ask me to approve transactions?",
      a: "No. Dubu only asks you to sign messages, to sign in or to link a wallet. Signing a message moves no funds and costs no gas.",
    },
    {
      q: "What if I lose my passkey?",
      a: "Passkeys sync through your Apple or Google account, so a new phone signed in to the same account still has it. If a passkey is deleted, Dubu cannot recover that wallet. Keep your Chog in your own wallet and link it, rather than sending it to the passkey wallet.",
    },
    { q: "How long are the videos?", a: `${length}${sizes}` },
    {
      q: "Why does my video have a watermark?",
      a: "Free videos carry a small Made with Dubu mark. Holder videos do not.",
    },
    {
      q: "Does Dubu keep my videos?",
      a: "There is no gallery. Download your video when it is ready. The link stops working within a day.",
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
