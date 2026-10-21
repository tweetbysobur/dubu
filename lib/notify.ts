"use client";

import { useSyncExternalStore } from "react";

/** In-app notifications. Celebrate ones also fire confetti. */
export type Toast = {
  id: number;
  tone: "celebrate" | "info" | "danger";
  title: string;
  body?: string;
  /** Optional token mark shown in the icon tile. */
  token?: "mon" | "chog";
  action?: { label: string; href: string };
};

let toasts: Toast[] = [];
let nextId = 1;
let celebrateTick = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function notify(t: Omit<Toast, "id">) {
  const toast = { ...t, id: nextId++ };
  toasts = [...toasts.slice(-2), toast]; // at most three on screen
  if (t.tone === "celebrate") celebrateTick++;
  emit();
  return toast.id;
}

export function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useToasts() {
  return useSyncExternalStore(subscribe, () => toasts, () => toasts);
}

/** Changes every time a celebrate toast arrives. */
export function useCelebrateTick() {
  return useSyncExternalStore(subscribe, () => celebrateTick, () => 0);
}

// Videos still rendering, kept across page loads so the result can be announced anywhere on the site.
const JOBS_KEY = "dubu.pendingJobs";
type PendingJob = { id: string; at: number };

export function pendingJobs(): PendingJob[] {
  try {
    const list = JSON.parse(localStorage.getItem(JOBS_KEY) || "[]") as PendingJob[];
    // Drop anything older than an hour: the render is long over by then.
    return list.filter((j) => typeof j.id === "string" && Date.now() - j.at < 60 * 60 * 1000);
  } catch {
    return [];
  }
}

function saveJobs(list: PendingJob[]) {
  try {
    localStorage.setItem(JOBS_KEY, JSON.stringify(list.slice(-5)));
  } catch {
    // Storage blocked: the result page still shows the video when it is done.
  }
}

export function trackJob(id: string) {
  saveJobs([...pendingJobs().filter((j) => j.id !== id), { id, at: Date.now() }]);
}

export function untrackJob(id: string) {
  saveJobs(pendingJobs().filter((j) => j.id !== id));
}
