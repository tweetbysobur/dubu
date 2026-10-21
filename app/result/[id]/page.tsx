"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, TIER_NAME, type JobStatus } from "@/lib/api";
import { burnWatermark, saveBlob } from "@/lib/watermark";
import { Alert, Button, Container, buttonClass } from "@/components/ui";
import { Mascot, type Mood } from "@/components/Mascot";

function fileStamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [elapsed, setElapsed] = useState(0);

  const job = useQuery<JobStatus>({
    queryKey: ["job", id],
    queryFn: () => api<JobStatus>(`/api/jobs/${encodeURIComponent(id)}`),
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 3000 : false),
    retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 3,
  });

  const processing = !job.isError && (job.isPending || job.data?.status === "processing");
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [processing]);

  const download = useMutation({
    mutationFn: async () => {
      const data = job.data!;
      const res = await fetch(data.videoUrl!, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Dubu could not download the video. Try again.");
      const blob = await res.blob();
      if (data.watermark) saveBlob(await burnWatermark(blob), `dubu-${fileStamp()}.webm`);
      else saveBlob(blob, `dubu-${fileStamp()}.mp4`);
    },
  });

  const failed = job.data?.status === "failed";
  const done = job.data?.status === "succeeded" && !!job.data.videoUrl;
  const mood: Mood = job.isError || failed ? "oops" : done ? "done" : "rolling";

  const title = job.isError
    ? "Dubu could not find this video"
    : failed
      ? "This video did not come out"
      : done
        ? "Your video is ready"
        : "Dubu is filming";

  const authError = job.error instanceof ApiError && job.error.status === 401;
  const goneError = job.error instanceof ApiError && [403, 404].includes(job.error.status);

  return (
    <main>
      <Container className="max-w-3xl py-8 sm:py-12">
        <Link
          href="/"
          className="-ml-2 inline-flex h-11 items-center gap-1.5 rounded-xl px-2 text-[15px] font-medium text-mute hover:bg-surface hover:text-ink"
        >
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to studio
        </Link>

        <div className="mt-6 flex items-center gap-4">
          <Mascot mood={mood} size={88} className="h-auto w-16 shrink-0 sm:w-20" decorative={false} />
          <div aria-live="polite">
            <h1 className="font-display text-[30px] font-extrabold leading-tight tracking-[-0.035em] sm:text-4xl">{title}</h1>
            {processing && (
              <p className="mt-1 tabular-nums text-mute">{elapsed}s so far. Keep this page open.</p>
            )}
          </div>
        </div>

        {processing && <div className="skeleton mt-8 aspect-video w-full rounded-3xl" aria-hidden />}

        {job.isError && (
          <div className="mt-8 space-y-5">
            <Alert>{authError ? "Your sign-in expired. Sign in again to see this video." : job.error.message}</Alert>
            {authError ? (
              <Link href="/" className={buttonClass("primary")}>
                Sign in again
              </Link>
            ) : goneError ? (
              <Link href="/" className={buttonClass("primary")}>
                Make a new video
              </Link>
            ) : (
              <Button variant="ghost" onClick={() => job.refetch()}>
                Try again
              </Button>
            )}
          </div>
        )}

        {failed && (
          <div className="mt-8 space-y-5">
            <Alert>{job.data?.error ?? "Generation failed."} This still counts toward today's videos.</Alert>
            <Link href="/" className={buttonClass("primary")}>
              Try another prompt
            </Link>
          </div>
        )}

        {done && job.data && (
          <div className="mt-8">
            <div className="relative flex min-h-48 justify-center overflow-hidden rounded-3xl bg-ink">
              <video
                src={job.data.videoUrl}
                controls
                autoPlay
                loop
                muted
                playsInline
                className="max-h-[70vh] w-auto max-w-full"
              />
              {job.data.watermark && (
                <span className="pointer-events-none absolute right-4 top-4 text-sm font-semibold text-white/85 drop-shadow">
                  Made with Dubu
                </span>
              )}
            </div>

            <div className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
              <div>
                <h2 className="text-sm font-medium text-mute">Prompt</h2>
                <p className="mt-1 text-lg leading-relaxed">{job.data.prompt}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-mute">
                  <span aria-hidden className={`size-2 shrink-0 rounded-full ${job.data.tier === "free" ? "bg-mute" : "bg-brand"}`} />
                  {job.data.watermark ? `${TIER_NAME[job.data.tier]}. Download has a watermark.` : `${TIER_NAME[job.data.tier]}. No watermark.`}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:w-56">
                <Button size="lg" loading={download.isPending} onClick={() => download.mutate()}>
                  {download.isPending ? (job.data.watermark ? "Adding watermark" : "Preparing download") : "Download video"}
                </Button>
                <Link href="/" className={buttonClass("ghost", "lg")}>
                  Make another video
                </Link>
              </div>
            </div>
            {download.isError && (
              <div className="mt-4">
                <Alert>{download.error.message}</Alert>
              </div>
            )}
          </div>
        )}
      </Container>
    </main>
  );
}
