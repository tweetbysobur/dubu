"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, getDefaultConfig, lightTheme } from "@rainbow-me/rainbowkit";
import { activeChain } from "@/lib/chain";

const config = getDefaultConfig({
  appName: "Dubu",
  projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || "dubu-local-dev",
  chains: [activeChain],
  ssr: true,
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
