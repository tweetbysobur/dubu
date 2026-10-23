"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError, formatChog, formatMon, type JobStatus } from "@/lib/api";
import { notify, pendingJobs, untrackJob } from "@/lib/notify";
import { useMe } from "@/lib/useSession";

/**
 * Announces deposits. Balances are re-read every 20 seconds while signed in
 * (every 8 on the Deposit page). A balance going up is a deposit only when the
 * other one did not go down at the same time: MON up with CHOG down is a sale,
 * CHOG up with MON down is a buy, and the swap page announces those itself.
 */
function DepositWatcher() {
  const pathname = usePathname();
  const fast = pathname === "/deposit";
  const me = useMe({ refetchInterval: (q) => (q.state.data ? (fast ? 8_000 : 20_000) : false) });
  const last = useRef<{ address: string; mon: number; chog: number } | null>(null);

  const address = me.data?.address;
  const mon = me.data?.mon.balance == null ? null : Number(me.data.mon.balance);
  const chog = me.data ? Number(me.data.wallets[0]?.chogBalance ?? 0) : null;

  useEffect(() => {
    if (!address || mon === null || chog === null) {
      last.current = null;
      return;
    }
    const prev = last.current;
    last.current = { address, mon, chog };
    if (!prev || prev.address !== address) return; // first reading for this wallet

    const monUp = mon - prev.mon;
    const chogUp = chog - prev.chog;
    if (monUp > 0 && chogUp >= 0) {
      notify({
        tone: "celebrate",
        token: "mon",
        title: `${formatMon(String(monUp))} MON received`,
        body: `Your wallet now holds ${formatMon(String(mon))} MON.`,
        ...(pathname !== "/profile" ? { action: { label: "View wallet", href: "/profile" } } : {}),
      });
    } else if (chogUp > 0 && monUp >= 0) {
      notify({
        tone: "celebrate",
        token: "chog",
        title: `${formatChog(String(chogUp))} CHOG received`,
        body: `Your wallet now holds ${formatChog(String(chog))} CHOG.`,
        ...(pathname !== "/profile" ? { action: { label: "View wallet", href: "/profile" } } : {}),
      });
    }
  }, [address, mon, chog, pathname]);

  return null;
}

const RANK = { free: 0, token: 1, holder: 2 } as const;

/** Announces a level going up, for example right after buying enough CHOG on the Swap page. */
function LevelWatcher() {
  const me = useMe();
  const last = useRef<{ address: string; tier: keyof typeof RANK } | null>(null);
  const d = me.data;

  useEffect(() => {
    if (!d) {
      last.current = null;
      return;
    }
    const prev = last.current;
    last.current = { address: d.address, tier: d.tier };
    if (!prev || prev.address !== d.address || RANK[d.tier] <= RANK[prev.tier]) return;
    notify({
      tone: "celebrate",
      token: d.tier === "token" ? "chog" : undefined,
      title: `You are a ${d.label} now`,
      body: `${d.limit} videos a day, ${d.quality}${d.watermark ? "" : ", no watermark"}.`,
      action: { label: "Make a video", href: "/studio" },
    });
  }, [d]);

  return null;
}

/** Announces a finished video wherever the user is on the site. */
function JobWatcher() {
  const pathname = usePathname();
  const qc = useQueryClient();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      for (const job of pendingJobs()) {
        let status: JobStatus;
        try {
          status = await api<JobStatus>(`/api/jobs/${encodeURIComponent(job.id)}`);
        } catch (e) {
          if (e instanceof ApiError && [401, 403, 404].includes(e.status)) untrackJob(job.id);
          continue;
        }
        if (stopped || status.status === "processing") continue;
        untrackJob(job.id);
        qc.invalidateQueries({ queryKey: ["me"] });
        const href = `/result/${encodeURIComponent(job.id)}`;
        const here = pathRef.current === href;
        if (status.status === "succeeded") {
          notify({
            tone: "celebrate",
            title: "Your video is ready",
            body: here ? "Watch it below, then download it." : "Dubu finished filming. Watch it and download it.",
            ...(here ? {} : { action: { label: "Watch video", href } }),
          });
        } else {
          notify({
            tone: "danger",
            title: "This video did not come out",
            body: "Try another prompt or image.",
            ...(here ? {} : { action: { label: "See details", href } }),
          });
        }
      }
    };
    const t = setInterval(check, 4_000);
    check();
    return () => {
      stopped = true;
      clearInterval(t);
    };
  }, [qc]);

  return null;
}

export function Watchers() {
  return (
    <>
      <DepositWatcher />
      <LevelWatcher />
      <JobWatcher />
    </>
  );
}
