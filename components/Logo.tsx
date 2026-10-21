import Link from "next/link";
import { Mascot } from "./Mascot";

export function Logo({ size = "md" }: { size?: "md" | "sm" }) {
  const icon = size === "md" ? 36 : 28;
  return (
    <Link
      href="/"
      aria-label="Dubu home"
      className="inline-flex items-center gap-1.5 rounded-lg font-display text-[26px] font-extrabold leading-none tracking-[-0.045em] text-ink"
    >
      <Mascot size={icon} />
      <span className={size === "sm" ? "text-[22px]" : ""}>dubu</span>
    </Link>
  );
}
