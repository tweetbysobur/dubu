import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Dubu: Chog video generator",
  description: "Turn your Chog into a short AI video. Built on Monad.",
};

export const viewport: Viewport = { themeColor: "#0b0a10" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-6 sm:pt-10">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
