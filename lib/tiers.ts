// Server-only tier facts. Every number shown in the UI comes from here, so it matches what the backend does.
//
// Three levels:
//   holder  Genesis holder: owns a Chog Genesis NFT. Full studio.
//   token   CHOG holder: holds at least CHOG_TOKEN_MIN CHOG across linked wallets.
//   free    everyone else.
export type Tier = "holder" | "token" | "free";
export const TIERS: Tier[] = ["holder", "token", "free"];

type TierInfo = { label: string; quality: string; watermark: boolean };

/** Holder and token levels share the sharper output; free gets the standard size. */
export function isSharp(tier: Tier) {
  return tier !== "free";
}

function qualityLabel(tier: Tier): string {
  if (process.env.DEAPI_API_KEY) {
    const px = isSharp(tier) ? process.env.DEAPI_SIZE_HOLDER || "768" : process.env.DEAPI_SIZE_FREE || "512";
    return `${px} px`;
  }
  if (process.env.REPLICATE_API_TOKEN) return isSharp(tier) ? "720p" : "480p";
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
  holder: { label: "Genesis holder", quality: qualityLabel("holder"), watermark: false },
  token: { label: "CHOG holder", quality: qualityLabel("token"), watermark: false },
  free: { label: "Free", quality: qualityLabel("free"), watermark: true },
};

function envLimit(name: string, fallback: number) {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

export function dailyLimit(tier: Tier): number {
  if (tier === "holder") return envLimit("HOLDER_DAILY_LIMIT", 50);
  if (tier === "token") return envLimit("TOKEN_DAILY_LIMIT", 10);
  return envLimit("FREE_DAILY_LIMIT", 3);
}

/**
 * Minimum CHOG balance for the CHOG holder level, as typed in config (whole tokens,
 * decimals allowed). Null means the level is switched off until the amount is decided.
 */
export function chogMinSetting(): string | null {
  const v = process.env.CHOG_TOKEN_MIN?.trim();
  return v && /^\d+(\.\d+)?$/.test(v) && Number(v) > 0 ? v : null;
}
