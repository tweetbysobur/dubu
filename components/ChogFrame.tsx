"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * A Chog seen through Dubu's camcorder: corner brackets, a REC light, the
 * token number and a running timecode, laid over the art. It is the same
 * viewfinder the brand is built on, so every Chog on the site looks like it
 * is already on set.
 */

const FPS = 30;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

/** "00:00:04:12" from a frame count. */
export function timecode(frames: number) {
  const f = frames % FPS;
  const s = Math.floor(frames / FPS);
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}:${pad(f)}`;
}

/** Counts frames while `running`, about ten updates a second. Static for reduced motion. */
export function useTimecode(running: boolean, start = 0) {
  const [frames, setFrames] = useState(start);
  useEffect(() => {
    if (!running) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now() - (start / FPS) * 1000;
    const t = setInterval(() => setFrames(Math.floor(((performance.now() - t0) / 1000) * FPS)), 100);
    return () => clearInterval(t);
  }, [running, start]);
  return frames;
}

function Corners({ size, inset, stroke }: { size: number; inset: number; stroke: number }) {
  const c = "pointer-events-none absolute border-white transition-colors group-hover:border-lens";
  const s = { width: size, height: size, borderWidth: 0 } as const;
  return (
    <>
      <span aria-hidden className={`${c} rounded-tl-lg`} style={{ ...s, left: inset, top: inset, borderLeftWidth: stroke, borderTopWidth: stroke }} />
      <span aria-hidden className={`${c} rounded-tr-lg`} style={{ ...s, right: inset, top: inset, borderRightWidth: stroke, borderTopWidth: stroke }} />
      <span aria-hidden className={`${c} rounded-bl-lg`} style={{ ...s, left: inset, bottom: inset, borderLeftWidth: stroke, borderBottomWidth: stroke }} />
      <span aria-hidden className={`${c} rounded-br-lg`} style={{ ...s, right: inset, bottom: inset, borderRightWidth: stroke, borderBottomWidth: stroke }} />
    </>
  );
}

function Battery() {
  return (
    <svg aria-hidden width="22" height="12" viewBox="0 0 22 12" fill="none">
      <rect x="0.75" y="0.75" width="18" height="10.5" rx="2.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="19.5" y="4" width="2" height="4" rx="1" fill="currentColor" />
      <rect x="3" y="3" width="13.5" height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

type Size = "xs" | "sm" | "lg";

/** The overlay alone, for laying over any square Chog image. */
export function ViewfinderOverlay({ tokenId, size = "sm", frames, take }: { tokenId: string; size?: Size; frames?: number; take?: string }) {
  const lg = size === "lg";
  const hud = lg ? "text-[13px] sm:text-sm" : "text-[11px]";
  if (size === "xs") {
    return (
      <div aria-hidden className="pointer-events-none absolute inset-0 [filter:drop-shadow(0_1px_1px_rgba(11,18,32,0.5))]">
        <Corners size={11} inset={6} stroke={2} />
      </div>
    );
  }
  // A soft shadow keeps the white readouts legible on light art without darkening it.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 text-white [filter:drop-shadow(0_1px_1.5px_rgba(11,18,32,0.55))]"
    >
      <Corners size={lg ? 34 : 18} inset={lg ? 16 : 9} stroke={lg ? 3 : 2} />

      {lg && (
        <>
          <div className={`absolute flex items-center gap-1.5 font-semibold tracking-wide ${hud}`} style={{ left: 30, top: 26 }}>
            <span className="dubu-rec-dot size-2.5 rounded-full bg-white" />
            REC
          </div>
          <div className="absolute" style={{ right: 30, top: 27 }}>
            <Battery />
          </div>
        </>
      )}
      {!lg && take && (
        <span className={`absolute font-semibold ${hud}`} style={{ right: 16, top: 14 }}>
          {take}
        </span>
      )}

      {lg && (
        <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-60" width="22" height="22" viewBox="0 0 22 22">
          <path d="M11 3v5M11 14v5M3 11h5M14 11h5" stroke="white" strokeWidth="1.25" strokeLinecap="round" />
        </svg>
      )}

      <div
        className={`absolute inset-x-0 flex items-end justify-between font-mono tabular-nums ${hud}`}
        style={{ bottom: lg ? 26 : 13, paddingLeft: lg ? 30 : 16, paddingRight: lg ? 30 : 16 }}
      >
        <span className="font-semibold">#{tokenId}</span>
        {frames !== undefined && <span>{timecode(frames)}</span>}
      </div>
    </div>
  );
}

/** A square Chog image with the viewfinder over it. */
export function ChogFrame({
  tokenId,
  src,
  alt,
  size = "sm",
  frames,
  take,
  className = "",
  onError,
  children,
}: {
  tokenId: string;
  src: string;
  alt: string;
  size?: Size;
  frames?: number;
  take?: string;
  className?: string;
  onError?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className={`group relative aspect-square overflow-hidden bg-surface ${size === "lg" ? "rounded-[2rem]" : size === "xs" ? "rounded-2xl" : "rounded-3xl"} ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading={size === "lg" ? "eager" : "lazy"} decoding="async" className="size-full object-cover" onError={onError} />
      <ViewfinderOverlay tokenId={tokenId} size={size} frames={frames} take={take} />
      {children}
    </div>
  );
}
