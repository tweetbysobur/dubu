import { fetchImage, imageResponse } from "@/lib/images";

// Cached by the Cache-Control header below, so a failed fetch is never pinned for a day.
export const dynamic = "force-dynamic";

// The CHOG token logo, as listed on CoinGecko. Override with CHOG_TOKEN_LOGO_URL.
const DEFAULT_LOGO = "https://coin-images.coingecko.com/coins/images/70930/large/chog.png";

/** Plain fallback mark when the logo host is unreachable. */
const FALLBACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#1F4FFF"/><text x="32" y="42" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="700" fill="#fff">C</text></svg>`;

export async function GET() {
  const img = await fetchImage(process.env.CHOG_TOKEN_LOGO_URL?.trim() || DEFAULT_LOGO).catch(() => null);
  if (img) return imageResponse(img);
  return new Response(FALLBACK, {
    headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300, s-maxage=300" },
  });
}
