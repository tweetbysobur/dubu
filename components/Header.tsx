"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useHeroCtaOffscreen } from "@/lib/heroCta";
import { useMe, useSignOut } from "@/lib/useSession";
import { TIER_NAME, type TierId } from "@/lib/api";
import { Logo } from "./Logo";
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
function AccountMenu({ address, tier }: { address: string; tier: TierId }) {
  const holder = tier !== "free";
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
        <span aria-hidden className={`size-2 rounded-full ${holder ? "bg-brand" : "bg-mute"}`} />
        {short(address)}
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-80 rounded-2xl border border-line bg-white p-4 shadow-[0_12px_32px_rgba(11,18,32,0.12)]">
          <p className="text-sm text-mute">{TIER_NAME[tier]}</p>
          <p className="mt-1 break-all text-sm font-medium tabular-nums">{address}</p>
          <div className="mt-4 grid gap-2">
            <Link href="/deposit" onClick={() => setOpen(false)} className={buttonClass("primary")}>
              Deposit
            </Link>
            <Link href="/profile" onClick={() => setOpen(false)} className={buttonClass("ghost")}>
              Profile and linked wallets
            </Link>
            <CopyAddress address={address} />
            <SignOutButton onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** Phone menu: three-line button that opens a full-width panel under the header. */
function MobileMenu({ links, address, tier, signInHref }: { links: NavLink[]; address?: string; tier: TierId; signInHref: string }) {
  const holder = tier !== "free";
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useDismiss(open, () => setOpen(false), ref);
  useEffect(() => setOpen(false), [pathname]);

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
        <div id="mobile-menu" className="absolute inset-x-0 top-full border-b border-line bg-white shadow-[0_16px_32px_rgba(11,18,32,0.08)]">
          <nav aria-label="Menu" className="px-4 py-2">
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="flex h-14 items-center border-b border-line text-lg font-semibold last:border-b-0"
              >
                {l.label}
              </a>
            ))}
          </nav>
          <div className="border-t border-line bg-surface px-4 py-4">
            {address ? (
              <>
                <p className="flex items-center gap-2 text-sm text-mute">
                  <span aria-hidden className={`size-2 rounded-full ${holder ? "bg-brand" : "bg-mute"}`} />
                  {TIER_NAME[tier]}
                </p>
                <p className="mt-1 break-all text-sm font-medium tabular-nums">{address}</p>
                <Link href="/deposit" onClick={() => setOpen(false)} className={`${buttonClass("primary", "lg")} mt-4 w-full`}>
                  Deposit
                </Link>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <CopyAddress address={address} />
                  <SignOutButton onDone={() => setOpen(false)} />
                </div>
              </>
            ) : (
              <a href={signInHref} onClick={() => setOpen(false)} className={`${buttonClass("primary", "lg")} w-full`}>
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
        ...(signedIn ? [{ href: "/studio", label: "Studio" }] : []),
      ]
    : signedIn
      ? [
          { href: "/studio", label: "Studio" },
          { href: "/profile", label: "Profile" },
          { href: "/faq", label: "FAQ" },
        ]
      : [
          { href: "/", label: "Home" },
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
          {signedIn && me.data && <AccountMenu address={me.data.address} tier={me.data.tier} />}
          {!signedIn && me.data === null && (!landing || heroCtaOffscreen) && (
            <a href={signInHref} className={buttonClass("primary")}>
              Sign in
            </a>
          )}
        </div>

        <MobileMenu links={links} address={me.data?.address} tier={me.data?.tier ?? "free"} signInHref={signInHref} />
      </div>
    </header>
  );
}
