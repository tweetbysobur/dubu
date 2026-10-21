import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none ${className}`}
    />
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  variant?: "primary" | "ghost";
  size?: "md" | "lg";
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-colors disabled:cursor-not-allowed";
const sizes = { md: "h-11 px-5 text-[15px]", lg: "h-14 px-7 text-base" };
const variants = {
  primary: "bg-brand text-white hover:bg-brand-press active:bg-brand-press disabled:bg-line disabled:text-mute",
  ghost: "border border-line bg-white text-ink hover:border-ink/30 disabled:text-mute",
};

export function buttonClass(variant: "primary" | "ghost" = "primary", size: "md" | "lg" = "md") {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}

export function Button({ loading, variant = "primary", size = "md", className = "", children, disabled, ...rest }: BtnProps) {
  return (
    <button className={`${buttonClass(variant, size)} ${className}`} disabled={disabled || loading} {...rest}>
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-line bg-white p-5 sm:p-7 ${className}`}>{children}</section>;
}

export function Alert({ children, tone = "danger" }: { children: ReactNode; tone?: "danger" | "info" }) {
  const styles = tone === "danger" ? "border-danger/25 bg-danger-wash text-danger" : "border-brand/20 bg-wash text-ink";
  return (
    <p role={tone === "danger" ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm leading-relaxed ${styles}`}>
      {children}
    </p>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-5xl px-4 sm:px-6 ${className}`}>{children}</div>;
}
