"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/60 bg-ink/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Dubu
        </Link>
        <ConnectButton chainStatus="icon" accountStatus="avatar" showBalance={false} />
      </div>
    </header>
  );
}
