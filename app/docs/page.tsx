import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui";
import { LevelMark } from "@/components/LevelBadge";
import { TIER_INFO, chogMinSetting, clipSeconds, dailyLimit, TIERS, type Tier } from "@/lib/tiers";
import { swapOpen } from "@/lib/swap";

export const metadata: Metadata = {
  title: "Docs | Dubu",
  description: "How to use Dubu: sign in, make a video from your Chog, write a good prompt, download a GIF, link wallets and swap.",
};

// Numbers on this page come from the same settings the server uses.
export const revalidate = 3600;

const SECTIONS = [
  { id: "start", title: "Get started" },
  { id: "sign-in", title: "Sign in" },
  { id: "levels", title: "Levels" },
  { id: "chogs", title: "Your Chog Genesis" },
  { id: "make", title: "Make a video" },
  { id: "prompts", title: "Write a good prompt" },
  { id: "download", title: "Download" },
  { id: "wallets", title: "Link a wallet" },
  { id: "wallet", title: "Deposit and swap" },
  { id: "safety", title: "Safety" },
  { id: "help", title: "Fix a problem" },
] as const;

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-24 border-t border-line pt-10 first:border-t-0 first:pt-0">
      <h2 id={`${id}-h`} className="font-display text-[28px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[32px]">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-[17px] leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-2 font-display text-xl font-bold tracking-[-0.02em]">{children}</h3>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-wash font-semibold tabular-nums text-brand">
            {i + 1}
          </span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-mute/60" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-surface px-5 py-4 text-base leading-relaxed text-mute">{children}</p>;
}

const a = "font-semibold text-brand underline-offset-4 hover:underline";

function unlocks(tier: Tier, min: string | null) {
  if (tier === "holder") return "A Chog Genesis NFT in any linked wallet";
  if (tier === "token") return min ? `${Number(min).toLocaleString("en-US")} CHOG across linked wallets` : "Not open yet";
  return "Signing in";
}

export default function DocsPage() {
  const seconds = clipSeconds();
  const min = chogMinSetting();
  const tiers = TIERS.filter((t) => t !== "token" || min);
  const swap = swapOpen();

  return (
    <main>
      <Container className="py-10 sm:py-16">
        <h1 className="font-display text-[44px] font-extrabold leading-[0.95] tracking-[-0.045em] sm:text-[60px]">Docs</h1>
        <p className="mt-4 max-w-[38rem] text-lg leading-relaxed text-mute">
          Everything you need to turn your Chog, or any image, into a short video or GIF. Short answers live in the{" "}
          <Link href="/faq" className={a}>
            FAQ
          </Link>
          .
        </p>

        <div className="mt-10 grid gap-10 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-14">
          <nav aria-label="On this page" className="md:sticky md:top-24 md:self-start">
            <p className="text-sm font-semibold text-mute">On this page</p>
            <ol className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 md:grid-cols-1">
              {SECTIONS.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="-mx-2 flex min-h-10 items-center rounded-lg px-2 text-[15px] text-mute hover:bg-surface hover:text-ink">
                    {s.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="max-w-[44rem] space-y-10">
            <Section id="start" title="Get started">
              <Steps
                items={[
                  <>
                    <b>Sign in</b> with a passkey or a wallet on the{" "}
                    <Link href="/#sign-in" className={a}>
                      home page
                    </Link>
                    .
                  </>,
                  <>
                    <b>Pick your image.</b> Holders pick their Chog. Everyone else uploads an image.
                  </>,
                  <>
                    <b>Say what it should do</b> in one or two sentences, then tap Make my video.
                  </>,
                  <>
                    <b>Download</b> the video or a GIF when it is ready
                    {seconds ? `. Each clip is about ${seconds} seconds.` : "."}
                  </>,
                ]}
              />
            </Section>

            <Section id="sign-in" title="Sign in">
              <H3>With a passkey</H3>
              <p>
                A passkey makes a free Dubu wallet with Face ID, Touch ID or your fingerprint. No app to install, no seed
                phrase, no gas. The key is made on your device and Dubu never sees it.
              </p>
              <Steps
                items={[
                  "Tap Continue with a passkey.",
                  "Pick your Dubu passkey from the list your phone shows. Each one is named with the date you made it.",
                  "New to Dubu? Tap Create a passkey instead.",
                ]}
              />
              <Note>
                Your phone keeps your passkeys in its passwords, synced to your iCloud or Google account. Even if the
                browser forgets you, the passkey is still there. Tap Continue with a passkey and pick it.
              </Note>
              <H3>With a wallet</H3>
              <p>
                Tap Connect a wallet and sign one message. Signing is free and moves nothing. Use this if your Chog is in
                that wallet and you want it as your main account.
              </p>
              <H3>More than one account</H3>
              <p>
                One device can hold several Dubu accounts. Use Switch account to move between them. Remove only takes the
                shortcut off this device. The wallet and its passkey stay safe.
              </p>
              <H3>Back up your passkey wallet</H3>
              <p>
                Profile, Export wallet shows the 24-word recovery phrase for your passkey wallet. Write it down and keep it
                offline. You can import it into MetaMask or any EVM wallet.
              </p>
            </Section>

            <Section id="levels" title="Levels">
              <p>Your level comes from every wallet on your account, checked onchain each time you make a video.</p>
              <div className={`grid gap-3 ${tiers.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                {tiers.map((t) => (
                  <div key={t} className="rounded-3xl border border-line p-5">
                    <p className="flex items-center gap-2.5 font-display text-lg font-bold">
                      <LevelMark tier={t} size={28} />
                      {TIER_INFO[t].label}
                    </p>
                    <dl className="mt-4 space-y-2.5 text-[15px]">
                      {[
                        ["Unlocks with", unlocks(t, min)],
                        ["Videos per day", String(dailyLimit(t))],
                        ["Video size", TIER_INFO[t].quality],
                        ["Watermark", TIER_INFO[t].watermark ? "Yes" : "No"],
                        ["Image", t === "holder" ? "Your own Chog" : "Any image you upload"],
                      ].map(([k, v]) => (
                        <div key={k} className="flex justify-between gap-3 border-t border-line pt-2.5">
                          <dt className="text-mute">{k}</dt>
                          <dd className="text-right font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="text-base text-mute">Daily videos reset at midnight UTC.</p>
            </Section>

            <Section id="chogs" title="Your Chog Genesis">
              <p>
                Your Chogs show on{" "}
                <Link href="/profile#chogs" className={a}>
                  Profile
                </Link>
                , from every wallet on your account. Tap Make a video on one and the studio opens with it loaded.
              </p>
              <H3>Chog not showing?</H3>
              <Steps
                items={[
                  <>
                    Make sure the wallet that holds it is linked. See{" "}
                    <a href="#wallets" className={a}>
                      Link a wallet
                    </a>
                    .
                  </>,
                  "If your level says Genesis holder but no Chog shows, type its token ID in the box on Profile. Missing one later? Tap Missing one? Add it by number.",
                  "Dubu checks that your wallet owns it, then keeps it on Profile. If you sell it, it drops off by itself.",
                ]}
              />
              <p>
                Holders get their Chog&apos;s traits added to the prompt, so the video keeps its look. You can see them under
                the Chog in the studio.
              </p>
            </Section>

            <Section id="make" title="Make a video">
              <Steps
                items={[
                  <>
                    Open the{" "}
                    <Link href="/studio" className={a}>
                      studio
                    </Link>
                    . Holders pick a Chog. Everyone else uploads a PNG, JPG or WebP, up to 10 MB.
                  </>,
                  "Write what it should do. Up to 500 characters.",
                  "Leave Let Dubu direct the shot on. Dubu looks at your image and your words and writes a full shot for the video model: the action in order, small movements, one slow camera move, the same look.",
                  "Tap Make my video. It takes a minute or two. You can leave the page; Dubu tells you when it is ready.",
                ]}
              />
              <p>
                The result page shows your words and the shot Dubu wrote, so you can see what the model was asked to make.
              </p>
              <Note>
                Dubu turns down images it should not animate, like nudity, graphic violence, real children or hate symbols.
                A turned-down image does not count against your videos for the day.
              </Note>
            </Section>

            <Section id="prompts" title="Write a good prompt">
              <Bullets
                items={[
                  "Say one main action. The clip is short, so one clear thing reads best.",
                  "Be specific: which paw, which way, how fast, what the weather is.",
                  "Add a feeling: happy, sleepy, surprised.",
                  "Do not describe the character. The image already does that.",
                  "Skip text, logos and real people's names. They will not appear.",
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-line p-4">
                  <p className="text-sm font-semibold text-mute">Too vague</p>
                  <p className="mt-1">make it move</p>
                  <p className="mt-3">a cool video</p>
                </div>
                <div className="rounded-2xl border border-brand/20 bg-wash p-4">
                  <p className="text-sm font-semibold text-brand">Clear</p>
                  <p className="mt-1">waves with its left paw, then smiles at the camera</p>
                  <p className="mt-3">dances in the rain, splashing in puddles, very happy</p>
                </div>
              </div>
            </Section>

            <Section id="download" title="Download">
              <Bullets
                items={[
                  "Download video saves the clip. Holder levels get an MP4. Free gets a WebM with the watermark added.",
                  "Download GIF makes a GIF in your browser. It is smaller and plays anywhere, including chats that do not autoplay video.",
                  "Free videos and GIFs carry a small Dubu watermark. Holder levels have none.",
                ]}
              />
            </Section>

            <Section id="wallets" title="Link a wallet">
              <p>
                Keep your Chog or CHOG in another wallet? Link it on{" "}
                <Link href="/profile#linked" className={a}>
                  Profile
                </Link>{" "}
                and it counts toward your level. You stay signed in with your account. Nothing moves and there is no gas.
              </p>
              <Steps
                items={[
                  "On Profile, tap Link a wallet.",
                  "Pick your wallet and sign one message. It proves the wallet is yours.",
                  "The wallet is disconnected right after, so it can never take over your account.",
                ]}
              />
              <p>
                Any EVM wallet that supports Monad works: MetaMask, Phantom, Backpack, OKX, Rabby, Bitget, Magic Eden, Trust,
                Coinbase, Rainbow, Zerion, Uniswap, Binance, SafePal, TokenPocket, OneKey and Ledger. Other phone wallets
                connect through WalletConnect, and any other browser wallet through Browser Wallet.
              </p>
            </Section>

            <Section id="wallet" title="Deposit and swap">
              <p>
                Your Dubu wallet is a normal Monad wallet. Profile shows its MON and CHOG. Tap Deposit for its address and
                QR code, then send MON on the Monad network only.
              </p>
              {swap ? (
                <p>
                  Swap turns MON into CHOG inside Dubu. Dubu compares Nad.fun and Uniswap and uses the better price. You see
                  the minimum you will get before you confirm, and Max keeps a little MON back for network fees.
                </p>
              ) : (
                <p>Swapping MON to CHOG inside Dubu is coming soon.</p>
              )}
            </Section>

            <Section id="safety" title="Safety">
              <Bullets
                items={[
                  "Signing in and linking only sign a message. They never move funds or cost gas.",
                  "Your passkey wallet's key is made on your device and wiped after each signature. Dubu never stores it.",
                  "Your image and prompt go to Dubu's video and writing services to make the clip, and nowhere else.",
                  "Your level is checked onchain on every video. Nothing in the browser can change it.",
                ]}
              />
            </Section>

            <Section id="help" title="Fix a problem">
              <dl className="space-y-5">
                {[
                  [
                    "My old passkey account is gone",
                    "It is not. Tap Continue with a passkey and pick the older Dubu wallet from the list. Browsers can forget the shortcut, but your phone keeps the passkey.",
                  ],
                  ["No passkey list shows up", "Make sure passkeys or iCloud Keychain are on in your phone settings, then try again."],
                  [
                    "My video failed",
                    "If Dubu cannot start it, it does not count. Try again, or try a clearer image with one main subject.",
                  ],
                  [
                    "The video does not match my words",
                    "Keep Let Dubu direct the shot on, and give one clear action. See Write a good prompt above.",
                  ],
                  ["The page looks plain, with no colors", "Refresh. It happens for a moment while a new version goes live."],
                ].map(([q, ans]) => (
                  <div key={q}>
                    <dt className="font-semibold">{q}</dt>
                    <dd className="mt-1 text-mute">{ans}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          </div>
        </div>
      </Container>
    </main>
  );
}
