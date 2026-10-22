"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useHeroCtaOffscreen } from "@/lib/heroCta";
import { useMe, useSignOut } from "@/lib/useSession";
import { formatChog, formatMon, TIER_NAME, type Me, type TierId } from "@/lib/api";
import { LevelBadge, LevelMark } from "./LevelBadge";
import { Logo } from "./Logo";
import { TokenIcon } from "./TokenIcon";
import { buttonClass, Spinner } from "./ui";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

type NavLink = { href: string; label: string };

/** Closes a popover on outside click or Escape. */
function useDismiss(open: boolean, close: () => void, ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close, ref]);
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClass("ghost")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // Clipboard blocked: the full address is on screen to select by hand.
        }
      }}
    >
      {copied ? "Address copied" : "Copy address"}
    </button>
  );
}

/** Signs out and opens the sign-in screen, where every account on this device is listed. */
function SwitchAccountButton({ onDone }: { onDone: () => void }) {
  const signOut = useSignOut();
  return (
    <button
      type="button"
      className={buttonClass("ghost")}
      disabled={signOut.isPending}
      onClick={() =>
        signOut.mutate(undefined, {
          onSettled: () => {
            onDone();
            window.location.assign("/#sign-in");
          },
        })
      }
    >
      Switch account
    </button>
  );
}

function SignOutButton({ onDone }: { onDone: () => void }) {
  const signOut = useSignOut();
  return (
    <button
      type="button"
      className={buttonClass("ghost")}
      disabled={signOut.isPending}
      onClick={() => signOut.mutate(undefined, { onSettled: onDone })}
    >
      {signOut.isPending && <Spinner />}
      Sign out
    </button>
  );
}

/** Desktop account dropdown. */
function AccountMenu({ address, tier, swap }: { address: string; tier: TierId; swap: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, () => setOpen(false), ref);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-2 rounded-2xl border border-line bg-white px-3.5 text-[15px] font-semibold tabular-nums hover:border-ink/30"
      >
        <LevelMark tier={tier} size={22} />
        {short(address)}
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-line bg-white p-4 shadow-[0_12px_32px_rgba(11,18,32,0.12)]">
          <LevelBadge tier={tier} size="sm" />
          <p className="mt-2 break-all text-sm font-medium tabular-nums">{address}</p>
          <div className="mt-4 grid gap-2">
            <div className={`grid gap-2 ${swap ? "grid-cols-2" : ""}`}>
              <Link href="/deposit" onClick={() => setOpen(false)} className={buttonClass("primary")}>
                Deposit
              </Link>
              {swap && (
                <Link href="/swap" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
                  Swap
                </Link>
              )}
            </div>
            <Link href="/profile" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
              Profile and linked wallets
            </Link>
            <CopyAddress address={address} />
            <SwitchAccountButton onDone={() => setOpen(false)} />
            <SignOutButton onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

const NAV_ICONS: Record<string, string> = {
  "/studio": "M4 7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2zM16 10l4-2.5v9L16 14",
  "/profile": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20a8 8 0 0 1 16 0",
  "/faq": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01",
  "/docs": "M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7",
  "/": "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  "#how-it-works": "M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01",
  "#holders": "M12 2.5 20.5 7v10L12 21.5 3.5 17V7zM12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8L12 14.2l-2.5 1.4.6-2.8L8 10.9l2.8-.3z",
  "#faq": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6M12 17h.01",
};

function Glyph({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/** Phone menu: a full-height sheet under the header. Account first, then pages, sign out last. */
function MobileMenu({ links, me, signInHref }: { links: NavLink[]; me: Me | null | undefined; signInHref: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const signOut = useSignOut();
  useDismiss(open, () => setOpen(false), ref);
  useEffect(() => setOpen(false), [pathname]);

  // The page behind should not scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  async function copy(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the address is on the Deposit page to select by hand.
    }
  }

  const close = () => setOpen(false);

  return (
    <div ref={ref} className="sm:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-white text-ink"
      >
        <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div
          id="mobile-menu"
          className="fixed inset-x-0 bottom-0 top-16 z-30 flex flex-col overflow-y-auto border-t border-line bg-white px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4"
        >
          {me && (
            <section aria-label="Your wallet" className="rounded-3xl bg-brand p-4 text-white">
              <div className="flex items-center gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/15">
                  <LevelMark tier={me.tier} size={30} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold tabular-nums">{short(me.address)}</p>
                  <p className="text-sm text-white/75">{TIER_NAME[me.tier]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => copy(me.address)}
                  aria-label={copied ? "Address copied" : "Copy address"}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-white/15 px-3 text-sm font-semibold hover:bg-white/25"
                >
                  {copied ? "Copied" : <Glyph d="M9 9h10v10H9zM5 15V5h10" size={18} />}
                </button>
              </div>

              <div className="mt-4 flex items-end justify-between gap-3 border-t border-white/15 pt-4">
                <div className="min-w-0">
                  <p className="text-sm text-white/75">Balance</p>
                  <p className="mt-0.5 flex items-center gap-2 font-display text-2xl font-bold tabular-nums">
                    <TokenIcon token="mon" size={24} />
                    {me.mon.balance === null ? "-" : formatMon(me.mon.balance)} <span className="text-base text-white/80">MON</span>
                  </p>
                </div>
                {me.chog.tracked && (
                  <p className="flex shrink-0 items-center gap-1.5 pb-1 text-sm font-semibold tabular-nums text-white/90">
                    <TokenIcon token="chog" size={18} />
                    {formatChog(me.chog.balance)} CHOG
                  </p>
                )}
              </div>

              <div className={`mt-4 grid gap-2 ${me.swap ? "grid-cols-2" : ""}`}>
                <Link
                  href="/deposit"
                  onClick={close}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[15px] font-semibold text-brand hover:bg-wash"
                >
                  <Glyph d="M12 5v14M5 12l7 7 7-7" size={18} />
                  Deposit
                </Link>
                {me.swap && (
                  <Link
                    href="/swap"
                    onClick={close}
                    className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/15 text-[15px] font-semibold text-white hover:bg-white/25"
                  >
                    <Glyph d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4" size={18} />
                    Swap
                  </Link>
                )}
              </div>
            </section>
          )}

          <nav aria-label="Menu" className="mt-4">
            <ul className="space-y-1">
              {links.map((l) => {
                const active = !l.href.startsWith("#") && pathname === l.href;
                return (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      onClick={close}
                      aria-current={active ? "page" : undefined}
                      className={`flex h-14 items-center gap-3 rounded-2xl px-3 text-[17px] font-semibold ${active ? "bg-wash text-brand" : "text-ink hover:bg-surface"}`}
                    >
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${active ? "bg-white text-brand" : "bg-surface text-mute"}`}>
                        <Glyph d={NAV_ICONS[l.href] ?? NAV_ICONS["/"]} />
                      </span>
                      <span className="flex-1">{l.label}</span>
                      <Glyph d="M9 6l6 6-6 6" size={18} />
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="mt-auto pt-6">
            {me ? (
              <div className="grid gap-2">
              <button
                type="button"
                disabled={signOut.isPending}
                onClick={() =>
                  signOut.mutate(undefined, {
                    onSettled: () => {
                      close();
                      window.location.assign("/#sign-in");
                    },
                  })
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-[15px] font-semibold text-ink hover:bg-surface"
              >
                <Glyph d="M16 3l4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12" size={18} />
                Switch account
              </button>
              <button
                type="button"
                disabled={signOut.isPending}
                onClick={() => signOut.mutate(undefined, { onSettled: close })}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line text-[15px] font-semibold text-danger hover:bg-danger-wash"
              >
                {signOut.isPending ? <Spinner /> : <Glyph d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 8l-4 4 4 4M6 12h10" size={18} />}
                Sign out
              </button>
              </div>
            ) : (
              <a href={signInHref} onClick={close} className={`${buttonClass("primary", "lg")} w-full`}>
                Sign in
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const me = useMe();
  const heroCtaOffscreen = useHeroCtaOffscreen();
  const signedIn = !!me.data;
  const landing = pathname === "/";

  const links: NavLink[] = landing
    ? [
        { href: "#how-it-works", label: "How it works" },
        { href: "#holders", label: "Holder mode" },
        { href: "#faq", label: "FAQ" },
        { href: "/docs", label: "Docs" },
        ...(signedIn ? [{ href: "/studio", label: "Studio" }] : []),
      ]
    : signedIn
      ? [
          { href: "/studio", label: "Studio" },
          { href: "/profile", label: "Profile" },
          { href: "/docs", label: "Docs" },
          { href: "/faq", label: "FAQ" },
        ]
      : [
          { href: "/", label: "Home" },
          { href: "/docs", label: "Docs" },
          { href: "/faq", label: "FAQ" },
        ];
  const signInHref = landing ? "#sign-in" : "/#sign-in";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <a
        href="#main"
        className="sr-only rounded-lg bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <div className="relative mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />

        <div className="hidden items-center gap-2 sm:flex">
          <nav aria-label="Main" className="flex items-center gap-1">
            {links.map((l) => {
              const active = !l.href.startsWith("#") && pathname === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-surface hover:text-ink ${active ? "text-ink" : "text-mute"}`}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
          {signedIn && me.data && <AccountMenu address={me.data.address} tier={me.data.tier} swap={me.data.swap} />}
          {!signedIn && me.data === null && (!landing || heroCtaOffscreen) && (
            <a href={signInHref} className={buttonClass("primary")}>
              Sign in
            </a>
          )}
        </div>

        <MobileMenu links={links} me={me.data} signInHref={signInHref} />
      </div>
    </header>
  );
}
