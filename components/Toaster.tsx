"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { dismiss, useCelebrateTick, useToasts, type Toast } from "@/lib/notify";
import { TokenIcon } from "./TokenIcon";

const LIFETIME_MS = 7000;
const COLORS = ["#1F4FFF", "#8FA8FF", "#6E54FF", "#0B1220", "#FFFFFF", "#FFB020"];

/** A short confetti burst from the top of the screen. Skipped for reduced motion. */
function Confetti() {
  const tick = useCelebrateTick();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (tick === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const count = w < 640 ? 90 : 150;
    const parts = Array.from({ length: count }, () => {
      const fromLeft = Math.random() < 0.5;
      return {
        x: fromLeft ? w * 0.2 : w * 0.8,
        y: h * 0.25,
        vx: (fromLeft ? 1 : -1) * (2 + Math.random() * 6) + (Math.random() - 0.5) * 3,
        vy: -(7 + Math.random() * 7),
        size: 5 + Math.random() * 6,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.3,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        round: Math.random() < 0.3,
      };
    });

    let frame = 0;
    let raf = 0;
    const total = 110;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const fade = frame > total - 30 ? (total - frame) / 30 : 1;
      for (const p of parts) {
        p.vy += 0.32;
        p.vx *= 0.985;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.globalAlpha = Math.max(0, fade);
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.color === "#FFFFFF") {
          ctx.strokeStyle = "#E3E8F2";
          ctx.lineWidth = 1;
        }
        if (p.round) {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2.4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          if (p.color === "#FFFFFF") ctx.strokeRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        }
        ctx.restore();
      }
      frame++;
      if (frame < total) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      ctx.clearRect(0, 0, w, h);
    };
  }, [tick]);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-[60] size-full" />;
}

function ToastIcon({ toast }: { toast: Toast }) {
  if (toast.token) {
    return (
      <span className="relative grid size-11 shrink-0 place-items-center rounded-2xl bg-wash">
        <TokenIcon token={toast.token} size={28} />
        <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-brand text-white ring-2 ring-white">
          <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </span>
      </span>
    );
  }
  const danger = toast.tone === "danger";
  return (
    <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${danger ? "bg-danger-wash text-danger" : "bg-brand text-white"}`}>
      <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
        {danger ? <path d="M12 8v5M12 16.5v.5M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /> : <path d="M20 6 9 17l-5-5" />}
      </svg>
    </span>
  );
}

function ToastCard({ toast }: { toast: Toast }) {
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => dismiss(toast.id), LIFETIME_MS);
    return () => clearTimeout(t);
  }, [paused, toast.id]);

  return (
    <li
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="dubu-toast pointer-events-auto flex w-full items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-[0_16px_40px_rgba(11,18,32,0.14)]"
    >
      <ToastIcon toast={toast} />
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="font-semibold leading-snug">{toast.title}</p>
        {toast.body && <p className="mt-0.5 text-sm leading-relaxed text-mute">{toast.body}</p>}
        {toast.action && (
          <Link
            href={toast.action.href}
            onClick={() => dismiss(toast.id)}
            className="mt-2 inline-flex h-9 items-center rounded-xl bg-brand px-3.5 text-sm font-semibold text-white hover:bg-brand-press"
          >
            {toast.action.label}
          </Link>
        )}
      </div>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
        className="-mr-1 -mt-1 grid size-9 shrink-0 place-items-center rounded-xl text-mute hover:bg-surface hover:text-ink"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </li>
  );
}

/** Notifications stack: under the header on phones, top right on larger screens. */
export function Toaster() {
  const toasts = useToasts();
  return (
    <>
      <Confetti />
      <ol
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-3 top-[4.5rem] z-[70] flex flex-col gap-2 sm:inset-x-auto sm:right-5 sm:w-[24rem]"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} />
        ))}
      </ol>
    </>
  );
}
