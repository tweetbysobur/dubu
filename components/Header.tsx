"use client";

import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Logo } from "./Logo";

export function Header() {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  // On the landing page the hero owns the connect action. Show it once.
  const showConnect = isConnected || pathname !== "/";

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white">
      <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-4 sm:px-6">
        <Logo />
        {showConnect && <ConnectButton label="Connect wallet" chainStatus="none" accountStatus="avatar" showBalance={false} />}
      </div>
    </header>
  );
}
