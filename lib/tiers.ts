export type Tier = "holder" | "free";

export const TIER_INFO: Record<Tier, { label: string; quality: string; watermark: boolean }> = {
  holder: { label: "Holder mode", quality: "720p", watermark: false },
  free: { label: "Free mode", quality: "480p", watermark: true },
};

export function dailyLimit(tier: Tier): number {
  return tier === "holder"
    ? Number(process.env.HOLDER_DAILY_LIMIT ?? 50)
    : Number(process.env.FREE_DAILY_LIMIT ?? 3);
}
