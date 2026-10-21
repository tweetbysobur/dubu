import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Toaster } from "@/components/Toaster";
import { Watchers } from "@/components/Watchers";

export const metadata: Metadata = {
  title: "Dubu: turn your Chog into a video",
  description: "Upload an image, write one sentence, get a short video. Chog Genesis holders get the full studio.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col bg-white font-sans text-ink">
        <Providers>
          <Header />
          <div id="main" tabIndex={-1} className="flex-1 outline-none">
            {children}
          </div>
          <Footer />
          <Toaster />
          <Watchers />
        </Providers>
      </body>
    </html>
  );
}
