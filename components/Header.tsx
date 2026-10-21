"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useHeroCtaOffscreen } from "@/lib/heroCta";
import { useMe, useSignOut } from "@/lib/useSession";
import { Logo } from "./Logo";
import { buttonClass, Spinner } from "./ui";

function short(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function AccountMenu({ address, holder }: { address: string; holder: boolean }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const signOut = useSignOut();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked: the full address is still visible to select by hand.
    }
  }

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
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-line bg-white p-4 shadow-[0_12px_32px_rgba(11,18,32,0.12)]">
          <p className="text-sm text-mute">{holder ? "Holder mode" : "Free mode"}</p>
          <p className="mt-1 break-all text-sm font-medium tabular-nums">{address}</p>
          <div className="mt-4 grid gap-2">
            <button type="button" onClick={copy} className={buttonClass("ghost")}>
              {copied ? "Address copied" : "Copy address"}
            </button>
            <button
              type="button"
              onClick={() => signOut.mutate(undefined, { onSettled: () => setOpen(false) })}
              className={buttonClass("ghost")}
              disabled={signOut.isPending}
            >
              {signOut.isPending && <Spinner />}
              Sign out
            </button>
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
  const landing = pathname === "/" && me.data === null;

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <a
        href="#main"
        className="sr-only rounded-lg bg-brand px-4 py-2 font-semibold text-white focus:not-sr-only focus:absolute focus:left-4 focus:top-3"
      >
        Skip to content
      </a>
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <div className="flex items-center gap-1 sm:gap-2">
          {landing && (
            <nav aria-label="Page sections" className="hidden items-center gap-1 sm:flex">
              <a href="#how-it-works" className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-mute hover:bg-surface hover:text-ink">
                How it works
              </a>
              <a href="#holders" className="rounded-xl px-3 py-2.5 text-[15px] font-medium text-mute hover:bg-surface hover:text-ink">
                Holder mode
              </a>
            </nav>
          )}
          {signedIn && me.data && <AccountMenu address={me.data.address} holder={me.data.tier === "holder"} />}
          {landing && heroCtaOffscreen && (
            <a href="#sign-in" className={buttonClass("primary")}>
              Sign in
            </a>
          )}
          {!signedIn && !landing && me.data === null && (
            <Link href="/" className={buttonClass("primary")}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
