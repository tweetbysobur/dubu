/** Official token marks: MON from Monad's token list, CHOG served through Dubu. */
export function TokenIcon({ token, size = 28, className = "" }: { token: "mon" | "chog"; size?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={token === "mon" ? "/tokens/mon.svg" : "/api/logo/chog"}
      alt={token === "mon" ? "MON" : "CHOG"}
      width={size}
      height={size}
      className={`shrink-0 rounded-full bg-surface ${className}`}
    />
  );
}
