"use client";

import { useQuery } from "@tanstack/react-query";
import { api, formatChog, type TierFacts } from "@/lib/api";

function items(t?: TierFacts): { q: string; a: string }[] {
  const free = t ? String(t.free.limit) : "a few";
  const tokenOn = !!t?.chogMin;
  const length = t?.clipSeconds ? `About ${t.clipSeconds} seconds.` : "A few seconds.";
  const sizes = t
    ? ` ${tokenOn ? "Genesis and CHOG holder" : "Genesis holder"} videos are ${t.holder.quality}. Free videos are ${t.free.quality}.`
    : "";

  return [
    {
      q: "What is Dubu?",
      a: "Dubu turns one image and one sentence into a short video. It is built for the Chog community on Monad: the more Chog you hold, the more you get.",
    },
    {
      q: "Do I need a Chog?",
      a: `No. Anyone can make ${free} videos a day for free by uploading an image. Holding a Chog Genesis NFT${tokenOn ? " or enough CHOG" : ""} unlocks more.`,
    },
    ...(t && tokenOn
      ? [
          {
            q: "What is the difference between a Genesis holder and a CHOG holder?",
            a: `A Chog Genesis NFT makes you a Genesis holder: your own Chog loads into the studio, its traits shape the prompt, and you get ${t.holder.limit} videos a day with no watermark. Holding at least ${formatChog(t.chogMin)} CHOG makes you a CHOG holder: ${t.token.quality} video, no watermark and ${t.token.limit} videos a day, with an image you upload. If you have both, you are a Genesis holder.`,
          },
        ]
      : []),
    {
      q: "How does Dubu check what I hold?",
      a: `Dubu reads the Chog Genesis contract${tokenOn ? " and your CHOG balance" : ""} on Monad for your sign-in wallet and every wallet you link. It checks again each time you make a video, so moving a Chog out of your wallets changes your level right away.`,
    },
    {
      q: "My Chog is in another wallet. How do I get credit for it?",
      a: `Open Profile and link that wallet. You sign one message with it to prove it is yours. Dubu adds up${tokenOn ? " the NFTs and CHOG in" : " what"} all your linked wallets${tokenOn ? "" : " hold"}. You can link up to 3 wallets, and each wallet can belong to one Dubu account at a time.`,
    },
    {
      q: "What is a passkey wallet?",
      a: "When you continue with a passkey, your phone or computer creates one with Face ID, a fingerprint or your screen lock. Dubu turns it into a wallet on your device. Dubu never sees its key, and you do not need to write anything down to start.",
    },
    {
      q: "Can I move my passkey wallet to MetaMask or another wallet?",
      a: "Yes. In Profile, Export wallet shows your 24-word recovery phrase after a passkey check. Import it into MetaMask, Rabby or any wallet that accepts a recovery phrase and the same address appears. The phrase stays on your device. Dubu never sees or stores it.",
    },
    {
      q: "What if I lose my passkey?",
      a: "Passkeys sync through your Apple or Google account, so a new phone signed in to the same account still has it. If a passkey is deleted and you never exported the recovery phrase, Dubu cannot recover that wallet. Export the phrase from Profile and keep it offline. Better still, keep your Chog in your own wallet and link it.",
    },
    {
      q: "Does Dubu cost gas or ask me to approve transactions?",
      a: "No. Dubu only asks you to sign messages, to sign in or to link a wallet. Signing a message moves no funds and costs no gas.",
    },
    { q: "How long are the videos?", a: `${length}${sizes}` },
    {
      q: "Why does my video have a watermark?",
      a: `Free videos carry a small Made with Dubu mark. ${tokenOn ? "Genesis and CHOG holder" : "Genesis holder"} videos do not.`,
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
