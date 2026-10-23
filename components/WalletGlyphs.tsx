/**
 * The wallet's three actions as one set. Deposit is an arrow into the tray, Withdraw the
 * same arrow leaving it, so the pair reads as in and out at a glance.
 */
export const GLYPH = {
  deposit: "M12 3v11M7.5 9.5L12 14l4.5-4.5M4 14v3.5A2.5 2.5 0 006.5 20h11a2.5 2.5 0 002.5-2.5V14",
  withdraw: "M12 14V3M7.5 7.5L12 3l4.5 4.5M4 14v3.5A2.5 2.5 0 006.5 20h11a2.5 2.5 0 002.5-2.5V14",
  swap: "M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4",
} as const;

export function WalletGlyph({ name, size = 20 }: { name: keyof typeof GLYPH; size?: number }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={GLYPH[name]} />
    </svg>
  );
}
