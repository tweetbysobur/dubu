"use client";

import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useHeroCtaOffscreen } from "@/lib/heroCta";
import { Logo } from "./Logo";

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const landing = pathname === "/" && !isConnected;
  const heroCtaHidden = useHeroCtaOffscreen();

  // On the landing page the hero owns the connect action until it scrolls away.
  const showConnect = !landing || heroCtaHidden;

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
          {showConnect && (
            <ConnectButton label="Connect wallet" chainStatus="none" accountStatus="avatar" showBalance={false} />
          )}
        </div>
      </div>
    </header>
  );
}
