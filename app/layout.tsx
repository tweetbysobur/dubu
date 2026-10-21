import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: "Dubu: turn your Chog into a video",
  description: "Upload an image, write one sentence, get a short video. Chog Genesis holders get the full studio.",
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white font-sans text-ink">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
