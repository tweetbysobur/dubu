// Server-only tier facts. Every number shown in the UI comes from here, so it matches what the backend does.
export type Tier = "holder" | "free";

type TierInfo = { label: string; quality: string; watermark: boolean };

function qualityLabel(tier: Tier): string {
  if (process.env.DEAPI_API_KEY) {
    const px = tier === "holder" ? process.env.DEAPI_SIZE_HOLDER || "768" : process.env.DEAPI_SIZE_FREE || "512";
    return `${px} px`;
  }
  if (process.env.REPLICATE_API_TOKEN) return tier === "holder" ? "720p" : "480p";
  return "Sample clip";
}

/** Clip length in seconds for the active provider, or null when unknown. */
export function clipSeconds(): number | null {
  if (!process.env.DEAPI_API_KEY) return null;
  const frames = Number(process.env.DEAPI_FRAMES || 120);
  const fps = Number(process.env.DEAPI_FPS || 30);
  return fps > 0 ? Math.round(frames / fps) : null;
}

export const TIER_INFO: Record<Tier, TierInfo> = {
  holder: { label: "Holder mode", quality: qualityLabel("holder"), watermark: false },
  free: { label: "Free mode", quality: qualityLabel("free"), watermark: true },
};

export function dailyLimit(tier: Tier): number {
  return tier === "holder" ? Number(process.env.HOLDER_DAILY_LIMIT ?? 50) : Number(process.env.FREE_DAILY_LIMIT ?? 3);
}
