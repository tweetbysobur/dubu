"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
import {
  backpackWallet,
  binanceWallet,
  bitgetWallet,
  coinbaseWallet,
  injectedWallet,
  ledgerWallet,
  magicEdenWallet,
  metaMaskWallet,
  okxWallet,
  oneKeyWallet,
  phantomWallet,
  rabbyWallet,
  rainbowWallet,
  safepalWallet,
  tokenPocketWallet,
  trustWallet,
  uniswapWallet,
  walletConnectWallet,
  zerionWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { activeChain } from "@/lib/chain";

// Any EVM wallet that can add Monad works. Wallets already in the browser show up
// on their own (EIP-6963); "Browser wallet" covers any other injected one, and
// WalletConnect covers every mobile wallet that is not listed by name.

const config = getDefaultConfig({
  appName: "Dubu",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "dubu-local-dev",
  chains: [activeChain],
  ssr: true,
  wallets: [
    {
      groupName: "Popular on Monad",
      wallets: [metaMaskWallet, phantomWallet, backpackWallet, okxWallet, rabbyWallet, bitgetWallet, magicEdenWallet],
    },
    {
      groupName: "More wallets",
      wallets: [
        trustWallet,
        coinbaseWallet,
        rainbowWallet,
        zerionWallet,
        uniswapWallet,
        binanceWallet,
        safepalWallet,
        tokenPocketWallet,
        oneKeyWallet,
        ledgerWallet,
        injectedWallet,
        walletConnectWallet,
      ],
    },
  ],
});

const theme = lightTheme({ accentColor: "#1F4FFF", accentColorForeground: "#fff", borderRadius: "large" });
theme.fonts.body = '"Inter Variable", ui-sans-serif, system-ui, sans-serif';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} appInfo={{ appName: "Dubu" }}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
