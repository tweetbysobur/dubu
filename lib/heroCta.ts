"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

// Tiny shared flag: is the landing hero's connect button off screen?
let offscreen = false;
const listeners = new Set<() => void>();
function set(v: boolean) {
  if (v === offscreen) return;
  offscreen = v;
  listeners.forEach((l) => l());
}

/** Header reads this to decide when to show its own connect button. */
export function useHeroCtaOffscreen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => offscreen,
    () => false,
  );
}

/** Attach to the hero CTA. Reports visibility while mounted, resets on unmount. */
export function useHeroCtaRef<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => set(!e.isIntersecting), { rootMargin: "-64px 0px 0px 0px" });
    io.observe(el);
    return () => {
      io.disconnect();
      set(false);
    };
  }, []);
  return ref;
}
