"use client";

import { useEffect, useRef, useState } from "react";
import { ViewfinderOverlay } from "./ChogFrame";
import { Mascot } from "./Mascot";

/**
 * A 12-second animated walkthrough of the studio, drawn with the real Chog
 * art: upload the Chog, say what it should do, Dubu films it, download the
 * video or GIF. It is a walkthrough of the steps, labeled as such, not a
 * generated result.
 */

const LOOP_MS = 13_000;
const PROMPT = "waves its left paw, then does a little happy dance";

const STEPS = [
  { at: 0, label: "Upload", long: "Upload your Chog" },
  { at: 2600, label: "Prompt", long: "Say what it should do" },
  { at: 6200, label: "Film", long: "Dubu films it" },
  { at: 9600, label: "Download", long: "Download video or GIF" },
] as const;

function useLoop(enabled: boolean) {
  const [t, setT] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let start = performance.now();
    let visible = true;
    // Pause off screen so the studio never does work nobody sees.
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start = performance.now() - t;
    });
    if (ref.current) io.observe(ref.current);
    const tick = (now: number) => {
      if (visible) setT((now - start) % LOOP_MS);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
  return { t, ref };
}

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const ease = (v: number) => 1 - Math.pow(1 - clamp(v), 3);

function Cursor({ x, y, pressed }: { x: number; y: number; pressed: boolean }) {
  return (
    <svg
      aria-hidden
      width="22"
      height="22"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute z-20 drop-shadow-[0_2px_3px_rgba(11,18,32,0.35)]"
      style={{ left: `${x}%`, top: `${y}%`, transform: `scale(${pressed ? 0.85 : 1})` }}
    >
      <path d="M4 2.5 19 12l-6.6 1.6L9.1 20z" fill="#0B1220" stroke="#fff" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function StudioTour({ chogSrc, chogId }: { chogSrc: string | null; chogId: string }) {
  const [reduced, setReduced] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches), []);
  const { t, ref } = useLoop(!reduced);

  const src = chogSrc && !broken ? chogSrc : null;
  const step = reduced ? -1 : [...STEPS].reverse().find((s) => t >= s.at)!;
  const stepIndex = reduced ? -1 : STEPS.indexOf(step as (typeof STEPS)[number]);

  // Step 1: the Chog drops into the upload slot.
  const drop = ease((t - 500) / 900);
  // Step 2: the sentence types out, then the button is pressed.
  const typed = PROMPT.slice(0, Math.floor(clamp((t - 2800) / 2600) * PROMPT.length));
  const pressing = t > 5700 && t < 6100;
  // Step 3: filming.
  const filming = clamp((t - 6200) / 3300);
  // Step 4: download.
  const saved = t > 10_900;

  // Cursor path: to the slot, to the box, to the button, then to Download.
  const path: [number, number, number][] = [
    [0, 80, 85],
    [500, 26, 55],
    [1400, 26, 55],
    [2600, 70, 40],
    [5300, 70, 40],
    [5700, 74, 74],
    [6300, 74, 74],
    [9800, 74, 74],
    [10_500, 46, 88],
    [12_400, 46, 88],
    [13_000, 80, 85],
  ];
  let cx = 80;
  let cy = 85;
  for (let i = 0; i < path.length - 1; i++) {
    const [ta, xa, ya] = path[i];
    const [tb, xb, yb] = path[i + 1];
    if (t >= ta && t <= tb) {
      const k = ease((t - ta) / Math.max(1, tb - ta));
      cx = xa + (xb - xa) * k;
      cy = ya + (yb - ya) * k;
    }
  }

  const art = (className: string, style?: React.CSSProperties) =>
    src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={className} style={style} onError={() => setBroken(true)} />
    ) : (
      <div className={`grid place-items-center bg-wash ${className}`} style={style}>
        <Mascot mood="idle" size={120} className="h-auto w-1/2" />
      </div>
    );

  if (reduced) {
    return (
      <ol className="grid gap-3 sm:grid-cols-4" aria-label="How the studio works">
        {STEPS.map((s, i) => (
          <li key={s.label} className="rounded-2xl bg-surface p-4 text-sm font-semibold">
            <span className="text-brand tabular-nums">{i + 1}.</span> {s.long}
          </li>
        ))}
      </ol>
    );
  }

  const phase = stepIndex; // 0..3
  // The filming motion: a wave and a hop, so it reads as the Chog moving.
  const ft = (t - 6200) / 1000;
  const dance =
    phase === 2
      ? { transform: `translateY(${-Math.abs(Math.sin(ft * 5)) * 5}%) rotate(${Math.sin(ft * 7) * 4}deg) scale(1.16)` }
      : undefined;

  return (
    <div ref={ref} className="select-none" aria-label="Animated walkthrough of the studio" role="img">
      <div className="relative aspect-[16/11] overflow-hidden rounded-[1.75rem] border border-line bg-surface sm:aspect-[16/9]">
        {/* Steps 1 and 2: the studio, in miniature. */}
        <div
          className="absolute inset-0 grid grid-cols-2 gap-3 p-4 transition-opacity duration-500 sm:gap-4 sm:p-6"
          style={{ opacity: phase <= 1 ? 1 : 0 }}
        >
          <div className="flex flex-col rounded-2xl border border-line bg-white p-3 sm:p-4">
            <p className="text-[11px] font-bold sm:text-sm">Your Chog</p>
            <div className="relative mt-2 flex-1 overflow-hidden rounded-xl border-2 border-dashed border-line">
              <div
                className="absolute inset-1.5 overflow-hidden rounded-lg"
                style={{ transform: `translateY(${(1 - drop) * -120}%) scale(${0.9 + drop * 0.1})`, opacity: drop }}
              >
                {art("size-full object-cover")}
              </div>
            </div>
          </div>
          <div className="flex flex-col rounded-2xl border border-line bg-white p-3 sm:p-4">
            <p className="text-[11px] font-bold sm:text-sm">What should your Chog do?</p>
            <div className="mt-2 flex-1 rounded-xl border border-line p-2 text-[11px] leading-snug sm:text-sm">
              {typed}
              {phase === 1 && !pressing && <span className="ml-px inline-block h-[1em] w-px animate-pulse bg-ink align-middle" />}
            </div>
            <div
              className="mt-2 rounded-xl bg-brand py-1.5 text-center text-[11px] font-semibold text-white transition-transform sm:py-2.5 sm:text-sm"
              style={{ transform: pressing ? "scale(0.95)" : "scale(1)" }}
            >
              Make my video
            </div>
          </div>
        </div>

        {/* Steps 3 and 4: the Chog on set, then the download. */}
        <div className="absolute inset-0 flex items-center justify-center p-4 transition-opacity duration-500 sm:p-6" style={{ opacity: phase >= 2 ? 1 : 0 }}>
          <div className="relative aspect-square h-full overflow-hidden rounded-[1.5rem] bg-white shadow-[0_16px_40px_rgba(11,18,32,0.16)]">
            {art("size-full object-cover", { transform: "scale(1.16)", ...dance, transition: phase === 2 ? undefined : "transform .4s" })}
            <div className="hidden sm:contents">
              <ViewfinderOverlay tokenId={chogId} size="lg" frames={phase === 2 ? Math.floor(ft * 30) : 121} />
            </div>
            <div className="contents sm:hidden">
              <ViewfinderOverlay tokenId={chogId} size="sm" />
            </div>
            <div className="absolute inset-x-6 bottom-12 h-1 overflow-hidden rounded-full bg-white/40 transition-opacity sm:inset-x-8 sm:bottom-14" style={{ opacity: phase === 3 ? 0 : 1 }}>
              <div className="h-full rounded-full bg-white" style={{ width: `${(phase === 3 ? 1 : filming) * 100}%` }} />
            </div>
          </div>
          {/* The download buttons slide in over the lower part of the frame. */}
          <div
            className="absolute inset-x-0 bottom-4 flex justify-center gap-2 transition-all duration-500 sm:bottom-6"
            style={{ opacity: phase === 3 ? 1 : 0, transform: `translateY(${phase === 3 ? 0 : 12}px)` }}
          >
            <div className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-[11px] font-semibold text-white shadow-[0_8px_20px_rgba(31,79,255,0.35)] sm:px-5 sm:py-2.5 sm:text-sm">
              {saved ? "Saved" : "Video"}
            </div>
            <div className="flex items-center rounded-xl border border-line bg-white px-3 py-2 text-[11px] font-semibold shadow-[0_8px_20px_rgba(11,18,32,0.12)] sm:px-5 sm:py-2.5 sm:text-sm">
              GIF
            </div>
          </div>
        </div>

        <Cursor x={cx} y={cy} pressed={pressing || (t > 10_500 && t < 10_900)} />
      </div>

      <ol className="mt-3 grid grid-cols-4 gap-2" aria-hidden>
        {STEPS.map((s, i) => (
          <li key={s.label} className="min-w-0">
            <div className="h-1 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-brand"
                style={{
                  width: `${i < phase ? 100 : i === phase ? clamp((t - s.at) / ((STEPS[i + 1]?.at ?? LOOP_MS) - s.at)) * 100 : 0}%`,
                }}
              />
            </div>
            <p className={`mt-1.5 truncate text-[11px] font-semibold sm:text-sm ${i === phase ? "text-ink" : "text-mute"}`}>
              <span className="sm:hidden">{s.label}</span>
              <span className="hidden sm:inline">{s.long}</span>
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
