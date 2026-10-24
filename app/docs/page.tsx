import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/ui";
import { LevelMark } from "@/components/LevelBadge";
import { DocsNav, type DocsGroup } from "@/components/DocsNav";
import { TIER_INFO, chogMinSetting, clipSeconds, dailyLimit, TIERS, type Tier } from "@/lib/tiers";
import { swapOpen } from "@/lib/swap";
import { directorEnabled } from "@/lib/director";
import { withdrawOpen } from "@/lib/withdraw";

export const metadata: Metadata = {
  title: "Docs | Dubu",
  description:
    "How to use Dubu: the content rules, making a video from your Chog or any image, writing a caption, downloading, levels, and the Dubu wallet.",
};

// Numbers on this page come from the same settings the server uses.
export const revalidate = 3600;

const GROUPS: DocsGroup[] = [
  { title: "Start here", items: [{ id: "overview", title: "What Dubu is" }, { id: "start", title: "Quick start" }] },
  { title: "Use Dubu for good", items: [{ id: "rules", title: "Content rules" }] },
  {
    title: "Make videos",
    items: [
      { id: "make", title: "The studio" },
      { id: "prompts", title: "Write a good caption" },
      { id: "download", title: "Download" },
      { id: "levels", title: "Levels" },
      { id: "chogs", title: "Your Chog Genesis" },
    ],
  },
  {
    title: "Your wallet",
    items: [
      { id: "sign-in", title: "Sign in" },
      { id: "wallets", title: "Link a wallet" },
      { id: "wallet", title: "Deposit" },
      { id: "swap", title: "Swap" },
      { id: "withdraw", title: "Withdraw" },
      { id: "backup", title: "Back up your wallet" },
    ],
  },
  { title: "Trust", items: [{ id: "safety", title: "Safety and privacy" }] },
  { title: "Help", items: [{ id: "help", title: "Fix a problem" }] },
];

const a = "font-semibold text-brand underline-offset-4 hover:underline";

function Section({ id, title, lead, children }: { id: string; title: string; lead?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-40 border-t border-line pt-10 first:border-t-0 first:pt-0 md:scroll-mt-24 sm:pt-12">
      <h2 id={`${id}-h`} className="font-display text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px] sm:tracking-[-0.035em]">
        {title}
      </h2>
      {lead && <p className="mt-2 text-base leading-relaxed text-mute sm:mt-3 sm:text-lg">{lead}</p>}
      <div className="mt-5 space-y-5 text-base leading-relaxed text-ink/90 sm:mt-6 sm:text-[17px]">{children}</div>
    </section>
  );
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="pt-3 font-display text-xl font-bold tracking-[-0.02em] text-ink">{children}</h3>;
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-4">
      {items.map((item, i) => (
        <li key={i} className="flex gap-4">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold tabular-nums text-white">{i + 1}</span>
          <span className="pt-0.5">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-[0.68em] size-1.5 shrink-0 rounded-full bg-brand" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Callout({ tone = "info", title, children }: { tone?: "info" | "warn"; title?: string; children: ReactNode }) {
  const styles = tone === "warn" ? "border-danger/20 bg-danger-wash" : "border-brand/15 bg-wash";
  return (
    <div className={`rounded-2xl border px-5 py-4 text-base leading-relaxed ${styles}`}>
      {title && <p className={`font-semibold ${tone === "warn" ? "text-danger" : "text-ink"}`}>{title}</p>}
      <div className={title ? "mt-1 text-ink/80" : "text-ink/80"}>{children}</div>
    </div>
  );
}

function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1F4FFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" className="mt-[0.2em] shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  ) : (
    <svg aria-hidden width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B42318" strokeWidth="2.6" strokeLinecap="round" className="mt-[0.2em] shrink-0">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

function unlocks(tier: Tier, min: string | null) {
  if (tier === "holder") return "A Chog Genesis NFT in any linked wallet";
  if (tier === "token") return min ? `${Number(min).toLocaleString("en-US")} CHOG across linked wallets` : "Not open yet";
  return "Signing in";
}

export default function DocsPage() {
  const seconds = clipSeconds();
  const min = chogMinSetting();
  // Lowest level first, so the cards read as the way up.
  const tiers = [...TIERS].reverse().filter((t) => t !== "token" || min);
  const swap = swapOpen();
  const director = directorEnabled();
  const withdraw = withdrawOpen();

  return (
    <main>
      <div className="border-b border-line">
        <Container className="pb-6 pt-8 sm:pb-10 sm:pt-14">
          <h1 className="font-display text-[34px] font-extrabold leading-none tracking-[-0.04em] sm:text-[52px]">Docs</h1>
          <p className="mt-3 max-w-[40rem] text-base leading-relaxed text-mute sm:text-lg">
            Make videos from your Chog or any image, level up, and use your Dubu wallet. Quick answers are in the{" "}
            <Link href="/faq" className={a}>
              FAQ
            </Link>
            .
          </p>
          <a
            href="#rules"
            className="mt-5 inline-flex max-w-full items-center gap-2.5 rounded-full border border-brand/20 bg-wash py-2 pl-3 pr-4 text-sm font-medium text-ink transition-colors hover:border-brand/40 sm:text-[15px]"
          >
            <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F4FFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
            <span className="min-w-0">
              For good, creative fun only. <span className="font-semibold text-brand">Content rules</span>
            </span>
          </a>
        </Container>
      </div>

      <Container className="pb-12 pt-0 sm:pb-16 md:pt-14">
        <div className="grid gap-8 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-16">
          <div className="sticky top-[var(--header-h,65px)] z-10 -mx-4 bg-white px-4 py-3 md:top-24 md:mx-0 md:max-h-[calc(100dvh-7rem)] md:self-start md:overflow-y-auto md:bg-transparent md:p-0 md:pb-6">
            <DocsNav groups={GROUPS} />
          </div>

          <div className="max-w-[46rem] space-y-10 sm:space-y-12">
            <Section
              id="overview"
              title="What Dubu is"
              lead="Dubu turns a still image into a short video. Pick your Chog or upload any image, say in plain words what it should do, and Dubu films it."
            >
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  ["Make", "One image and one sentence become a clip" + (seconds ? ` of about ${seconds} seconds` : "") + ". Download it as a video or a GIF.", "#make"],
                  ["Level up", "Hold CHOG or a Chog Genesis NFT for more videos a day, sharper video and no watermark.", "#levels"],
                  ["Your wallet", "Sign in with a passkey and get a free Monad wallet. Deposit, swap and withdraw right here.", "#sign-in"],
                ].map(([t, d, href]) => (
                  <a key={t} href={href} className="rounded-2xl border border-line p-5 transition-colors hover:border-brand/40 hover:bg-wash">
                    <p className="font-display text-lg font-bold">{t}</p>
                    <p className="mt-1.5 text-[15px] leading-relaxed text-mute">{d}</p>
                  </a>
                ))}
              </div>
            </Section>

            <Section id="start" title="Quick start">
              <Steps
                items={[
                  <>
                    <b>Sign in</b> with a passkey or a wallet on the{" "}
                    <Link href="/#sign-in" className={a}>
                      home page
                    </Link>
                    . It is free and moves nothing.
                  </>,
                  <>
                    <b>Add your image.</b> Genesis holders pick their Chog. Everyone else uploads a PNG, JPG or WebP.
                  </>,
                  <>
                    <b>Say what it should do</b> in one or two sentences, then tap Make my video.
                  </>,
                  <>
                    <b>Download</b> the video or a GIF when it is ready.
                  </>,
                ]}
              />
            </Section>

            <Section
              id="rules"
              title="Content rules"
              lead="Dubu is made for fun, creative videos of your characters. Everyone who uses it agrees to keep it that way."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-brand/20 bg-wash p-5">
                  <p className="font-display text-lg font-bold">Welcome</p>
                  <ul className="mt-3 space-y-2.5 text-base">
                    {[
                      "Your NFTs and characters, doing anything fun",
                      "Your own art, drawings and mascots",
                      "Pets, objects and scenes",
                      "Memes, reactions and celebrations for your community",
                    ].map((x) => (
                      <li key={x} className="flex gap-2.5">
                        <Mark ok />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border border-danger/20 bg-danger-wash p-5">
                  <p className="font-display text-lg font-bold">Not allowed</p>
                  <ul className="mt-3 space-y-2.5 text-base">
                    {[
                      "Nudity or sexual content of any kind",
                      "Anything that involves children in a sexual or harmful way",
                      "Graphic violence, gore or self-harm",
                      "Hate, harassment or bullying",
                      "Real people without their permission, or making anyone appear to do or say something they did not",
                      "Scams, fake endorsements, or posing as another project or brand",
                      "Anything illegal where you or the people in it live",
                    ].map((x) => (
                      <li key={x} className="flex gap-2.5">
                        <Mark ok={false} />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <H3>How Dubu holds the line</H3>
              <Bullets
                items={[
                  "Every caption is checked before anything is made. A caption that asks for nudity, sexual content, gore, self-harm or hate is turned down, and it does not use one of your videos.",
                  director
                    ? "Uploaded images are checked too. An image that shows nudity, graphic violence, a real child or hate symbols is turned down, and it does not count."
                    : "Image checks run when Dubu's shot writer is on. Either way, uploading an image that breaks these rules breaks them.",
                  "The video model only animates the image you give it. It cannot see who is in it, so you are responsible for having the right to use that image.",
                ]}
              />
              <Callout title="Only upload what you have the right to use">
                Your own NFTs and art, or images you have permission to use. Do not upload photos of other people without asking
                them first.
              </Callout>
            </Section>

            <Section id="make" title="The studio" lead="Where a still image becomes a video.">
              <Steps
                items={[
                  <>
                    Open the{" "}
                    <Link href="/studio" className={a}>
                      studio
                    </Link>
                    . Genesis holders pick a Chog. Everyone else uploads a PNG, JPG or WebP, up to 10 MB.
                  </>,
                  "Write what it should do, up to 500 characters.",
                  "Tap Make my video. It takes about a minute. You can leave the page; Dubu tells you when it is ready.",
                ]}
              />
              <H3>How Dubu reads your caption</H3>
              <p>
                Dubu reads your sentence word for word: the action, where it happens, any effects, and the camera if you name
                one. It keeps your character exactly as drawn, and it adds nothing you did not ask for. A vague caption gets
                gentle, natural motion rather than an invented scene.
              </p>
              {director && (
                <p>
                  With <b>Let Dubu direct the shot</b> on, Dubu also looks at your image and writes a fuller shot. If that shot
                  drops the action you asked for, Dubu uses your caption instead. The result page shows the shot it used.
                </p>
              )}
              <Callout title="A video that fails does not count">
                If Dubu cannot start or finish a video, it gives that video back. A video that takes more than 15 minutes is
                stopped and given back too.
              </Callout>
            </Section>

            <Section id="prompts" title="Write a good caption" lead="One clear action reads best in a short clip.">
              <Bullets
                items={[
                  "Say one main action: waves, dances, walks, jumps.",
                  "Add where it happens and how: through the rain, slowly, very happy.",
                  "Name a camera move if you want one: the camera slowly orbits the character.",
                  "Do not describe the character. The image already does that.",
                  "Skip text, logos and real people's names. They will not appear.",
                ]}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-line p-5">
                  <p className="text-sm font-semibold text-mute">Too vague</p>
                  <p className="mt-2">make it move</p>
                  <p className="mt-2">a cool video</p>
                </div>
                <div className="rounded-2xl border border-brand/20 bg-wash p-5">
                  <p className="text-sm font-semibold text-brand">Clear</p>
                  <p className="mt-2">Make the character wave.</p>
                  <p className="mt-2">Make the character walk through the rain.</p>
                  <p className="mt-2">Make the camera slowly orbit the character.</p>
                </div>
              </div>
            </Section>

            <Section id="download" title="Download">
              <Bullets
                items={[
                  "Download video saves the clip as an MP4 in browsers that can make one, which is most of them, including iPhone.",
                  "Download GIF makes a GIF in your browser. It is smaller and plays anywhere, even in chats that do not play video.",
                  "On a phone, tap Download, then Save. Your phone's share sheet opens, with Save Video or Save Image.",
                  "Free videos and GIFs carry a small Made with Dubu watermark. CHOG holders and Genesis holders get none.",
                ]}
              />
            </Section>

            <Section id="levels" title="Levels" lead="Your level comes from every wallet on your account, checked onchain each time you make a video.">
              <div className={`grid gap-3 ${tiers.length === 3 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}>
                {tiers.map((t) => (
                  <div key={t} className={`rounded-3xl border p-5 ${t === "holder" ? "border-brand bg-brand text-white" : "border-line"}`}>
                    <p className="flex items-center gap-2.5 font-display text-lg font-bold">
                      <LevelMark tier={t} size={28} />
                      {TIER_INFO[t].label}
                    </p>
                    <p className={`mt-4 font-display text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums`}>{dailyLimit(t)}</p>
                    <p className={`mt-1 text-sm font-medium ${t === "holder" ? "text-white/85" : "text-mute"}`}>videos a day</p>
                    <dl className="mt-4 space-y-2 text-[15px]">
                      {[
                        ["Unlocks with", unlocks(t, min)],
                        ["Video size", TIER_INFO[t].quality],
                        ["Watermark", TIER_INFO[t].watermark ? "Yes" : "No"],
                        ["Image", t === "holder" ? "Your own Chog, or any image" : "Any image you upload"],
                      ].map(([k, v]) => (
                        <div key={k} className={`flex justify-between gap-3 border-t pt-2 ${t === "holder" ? "border-white/20" : "border-line"}`}>
                          <dt className={t === "holder" ? "text-white/80" : "text-mute"}>{k}</dt>
                          <dd className="text-right font-medium tabular-nums">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
              </div>
              <p className="text-base text-mute">Daily videos reset at midnight UTC.</p>
              {swap && min && (
                <Callout title="Level up without leaving Dubu">
                  No CHOG yet? Deposit MON, then open{" "}
                  <Link href="/swap" className={a}>
                    Swap
                  </Link>
                  . It shows how much CHOG you need for CHOG holder and fills in the buy. The moment the CHOG lands, your
                  level and badge change on their own. See <a href="#swap" className={a}>Swap</a>.
                </Callout>
              )}
            </Section>

            <Section id="chogs" title="Your Chog Genesis">
              <p>
                Your Chogs show on{" "}
                <Link href="/profile#chogs" className={a}>
                  Profile
                </Link>
                , from every wallet on your account. Tap one and the studio opens with it loaded, traits and all, so the video
                keeps its look.
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
                  "If your level says Genesis holder but no Chog shows, type its token number on Profile.",
                  "Dubu checks that your wallet owns it, then keeps it on Profile. If you sell it, it drops off by itself.",
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
                  "New to Dubu? Tap Create a passkey.",
                  "Coming back? Tap Continue with a passkey and pick your Dubu passkey. Each one is named with the date you made it.",
                ]}
              />
              <Callout>
                Your phone keeps passkeys in its passwords, synced to your iCloud or Google account. If a browser forgets you, the
                passkey is still there.
              </Callout>
              <H3>With a wallet</H3>
              <p>
                Tap Connect a wallet and sign one message. Signing is free and moves nothing. Any EVM wallet that supports Monad
                works.
              </p>
              <H3>More than one account</H3>
              <p>One device can hold several Dubu accounts. Use Switch account to move between them.</p>
            </Section>

            <Section id="wallets" title="Link a wallet" lead="Keep your Chog or CHOG in another wallet and still get the level it earns.">
              <Steps
                items={[
                  <>
                    On{" "}
                    <Link href="/profile#linked" className={a}>
                      Profile
                    </Link>
                    , tap Link a wallet.
                  </>,
                  "Pick your wallet and sign one message. It proves the wallet is yours. Nothing moves and there is no gas.",
                  "The wallet is disconnected right after. It counts toward your level but can never take over your account.",
                ]}
              />
              <p className="text-base text-mute">
                Works with MetaMask, Phantom, Backpack, OKX, Rabby, Bitget, Magic Eden, Trust, Coinbase, Rainbow, Zerion,
                Uniswap, Binance, SafePal, TokenPocket, OneKey, Ledger, and any other wallet through WalletConnect or Browser
                Wallet.
              </p>
            </Section>

            <Section id="wallet" title="Deposit" lead="Your Dubu wallet is a normal Monad wallet. Profile shows its MON and CHOG.">
              <Steps
                items={[
                  <>
                    Open{" "}
                    <Link href="/deposit" className={a}>
                      Deposit
                    </Link>{" "}
                    for your address and its QR code.
                  </>,
                  "Send MON or CHOG to it on the Monad network.",
                  "Dubu tells you when it lands.",
                ]}
              />
              <Callout tone="warn" title="Monad only">
                Sending from Ethereum, Base, BNB Chain or any other network can lose the funds. Dubu cannot recover them.
              </Callout>
            </Section>

            <Section id="swap" title="Swap" lead="The way to a higher level without switching apps.">
              {swap ? (
                <>
                  <p>
                    Say you want CHOG holder and you have no CHOG. Instead of moving between apps, deposit MON and open{" "}
                    <Link href="/swap" className={a}>
                      Swap
                    </Link>
                    . It shows how much CHOG you hold toward the next level and can fill in the exact buy that gets you there,
                    counted at the worst price your slippage allows.
                  </p>
                  <Steps
                    items={[
                      "Tap Fill in the buy, or type an amount yourself.",
                      "Check the review: what you pay, the least you will get, the route and the network fee.",
                      "Confirm once. Dubu follows the transaction until Monad confirms it and never asks you to sign it twice.",
                      "When the CHOG lands, your level and badge change on their own.",
                    ]}
                  />
                  <p>
                    Dubu compares Nad.fun and Uniswap and uses the better price. Selling CHOG back to MON works the same way. A
                    Nad.fun sale is one confirmation; a Uniswap sale first asks you to allow exactly that much CHOG.
                  </p>
                </>
              ) : (
                <p>Swapping between MON and CHOG inside Dubu is opening soon.</p>
              )}
            </Section>

            <Section id="withdraw" title="Withdraw" lead="Your funds are yours. Move them out any time.">
              {withdraw ? (
                <>
                  <Steps
                    items={[
                      <>
                        Open{" "}
                        <Link href="/withdraw" className={a}>
                          Withdraw
                        </Link>{" "}
                        and pick MON or CHOG.
                      </>,
                      "Enter the amount and paste the Monad address. Max on MON keeps back exactly the network fee.",
                      "Check the review. The address is shown in full, in groups of four, so you can compare it.",
                      "Confirm once.",
                    ]}
                  />
                  <Callout tone="warn" title="A withdrawal cannot be undone">
                    Dubu refuses addresses that would lose the funds: the zero address, your own wallet, and token or exchange
                    contracts. Sending to an exchange? Make sure it accepts Monad deposits.
                  </Callout>
                </>
              ) : (
                <p>Withdrawals are paused for now. Your funds stay in your wallet, and you can export the wallet from Profile.</p>
              )}
            </Section>

            <Section id="backup" title="Back up your wallet">
              <p>
                On Profile, Export wallet shows the 24-word recovery phrase for your passkey wallet. Write it down and keep it
                offline. It works in MetaMask, Rabby or any wallet that accepts a recovery phrase.
              </p>
              <Callout tone="warn" title="Never share it">
                Anyone with these words controls the wallet. Dubu will never ask for them.
              </Callout>
            </Section>

            <Section id="safety" title="Safety and privacy">
              <Bullets
                items={[
                  "Signing in and linking only sign a message. They never move funds or cost gas.",
                  "Your passkey wallet's key is made on your device and wiped after each signature. Dubu never stores it.",
                  "Every swap and withdrawal is built for your wallet only, checked before it is sent, and confirmed by you.",
                  "Your image and caption go to Dubu's video service to make the clip, and nowhere else.",
                  "Your level is checked onchain on every video. Nothing in the browser can change it.",
                ]}
              />
            </Section>

            <Section id="help" title="Fix a problem">
              <dl className="divide-y divide-line rounded-2xl border border-line">
                {[
                  ["My old passkey account is gone", "It is not. Tap Continue with a passkey and pick the older Dubu passkey from the list. Browsers can forget the shortcut, but your phone keeps the passkey."],
                  ["No passkey list shows up", "Make sure passkeys or iCloud Keychain are on in your phone settings, then try again."],
                  ["My caption was turned down", "It asked for something the content rules do not allow. It did not use one of your videos. Try a different idea."],
                  ["My video failed", "A failed video does not count. Try again, or use a clearer image with one main subject."],
                  ["The video does not match my words", "Give one clear action, and say where it happens. See Write a good caption."],
                  ["My level did not change after buying CHOG", "Give it a few seconds after the swap lands. If the CHOG is in another wallet, link that wallet."],
                  ["The page looks plain, with no colors", "Refresh. It can happen for a moment while a new version goes live."],
                ].map(([q, ans]) => (
                  <div key={q} className="px-5 py-4">
                    <dt className="font-semibold">{q}</dt>
                    <dd className="mt-1 text-base text-mute">{ans}</dd>
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
