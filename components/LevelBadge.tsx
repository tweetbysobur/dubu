import { TIER_NAME, type TierId } from "@/lib/api";
import { TokenIcon } from "./TokenIcon";

/**
 * Each level has its own mark:
 * - Genesis holder: a crest with a gold star, for the NFT holders.
 * - CHOG holder: the CHOG token itself.
 * - Free: a play mark, since free still makes videos.
 */
export function LevelMark({ tier, size = 20 }: { tier: TierId; size?: number }) {
  if (tier === "token") return <TokenIcon token="chog" size={size} className="ring-1 ring-brand/20" />;
  if (tier === "holder") {
    return (
      <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
        <path d="M12 1.5 21.1 6.75v10.5L12 22.5l-9.1-5.25V6.75z" fill="#FFFFFF" />
        <path d="M12 3.8 19.1 7.9v8.2L12 20.2l-7.1-4.1V7.9z" fill="#1F4FFF" />
        <path d="m12 7.2 1.35 3.05 3.3.32-2.5 2.2.74 3.25L12 14.33l-2.89 1.69.74-3.25-2.5-2.2 3.3-.32z" fill="#FFB020" />
      </svg>
    );
  }
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" className="shrink-0">
      <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="#FFFFFF" stroke="#C9D2E3" strokeWidth="1.5" />
      <path d="M10 8.4v7.2a.6.6 0 0 0 .9.52l5.7-3.6a.6.6 0 0 0 0-1.04l-5.7-3.6a.6.6 0 0 0-.9.52z" fill="#4A5568" />
    </svg>
  );
}

const STYLES: Record<TierId, string> = {
  holder: "bg-brand text-white",
  token: "bg-wash text-brand ring-1 ring-brand/15",
  free: "bg-surface text-ink ring-1 ring-line",
};

/** The level as a pill with its own mark. */
export function LevelBadge({ tier, size = "md", className = "" }: { tier: TierId; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = {
    sm: { pill: "h-7 gap-1.5 pl-1 pr-2.5 text-[13px]", mark: 20 },
    md: { pill: "h-8 gap-2 pl-1 pr-3 text-sm", mark: 24 },
    lg: { pill: "h-11 gap-2.5 pl-1.5 pr-4 text-base", mark: 32 },
  }[size];
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full font-semibold ${STYLES[tier]} ${s.pill} ${className}`}>
      <LevelMark tier={tier} size={s.mark} />
      {TIER_NAME[tier]}
    </span>
  );
}
