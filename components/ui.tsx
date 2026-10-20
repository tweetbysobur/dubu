import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 animate-spin motion-reduce:animate-none rounded-full border-2 border-current border-r-transparent ${className}`}
    />
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "ghost";
};

export function Button({ loading, variant = "primary", className = "", children, disabled, ...rest }: BtnProps) {
  const base =
    "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-monad disabled:cursor-not-allowed disabled:opacity-50";
  const styles =
    variant === "primary"
      ? "bg-monad text-white hover:bg-monad-soft"
      : "border border-line bg-transparent text-white hover:bg-panel";
  return (
    <button className={`${base} ${styles} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-line bg-panel p-5 sm:p-6 ${className}`}>{children}</section>;
}

export function Alert({ children, tone = "bad" }: { children: ReactNode; tone?: "bad" | "info" }) {
  const styles = tone === "bad" ? "border-bad/40 bg-bad/10 text-bad" : "border-monad/40 bg-monad/10 text-monad-soft";
  return (
    <p role={tone === "bad" ? "alert" : "status"} className={`rounded-xl border px-4 py-3 text-sm ${styles}`}>
      {children}
    </p>
  );
}
