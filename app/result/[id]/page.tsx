"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { api, ApiError, type JobStatus } from "@/lib/api";
import { burnWatermark, saveBlob } from "@/lib/watermark";
import { Alert, Button, Card, Spinner } from "@/components/ui";

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const [elapsed, setElapsed] = useState(0);

  const job = useQuery<JobStatus>({
    queryKey: ["job", id],
    queryFn: () => api<JobStatus>(`/api/jobs/${encodeURIComponent(id)}`),
    refetchInterval: (q) => (q.state.data?.status === "processing" ? 3000 : false),
    retry: (count, err) => !(err instanceof ApiError && [401, 403, 404].includes(err.status)) && count < 3,
  });

  const processing = job.isPending || job.data?.status === "processing";
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [processing]);

  const download = useMutation({
    mutationFn: async () => {
      const data = job.data!;
      const res = await fetch(data.videoUrl!, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Could not download the video.");
      const blob = await res.blob();
      if (data.watermark) saveBlob(await burnWatermark(blob), `dubu-${id.slice(0, 8)}.webm`);
      else saveBlob(blob, `dubu-chog-${id.slice(0, 8)}.mp4`);
    },
  });

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-mute hover:text-white">
        ← New video
      </Link>

      {job.isError && (
        <Card className="space-y-4">
          <Alert>{job.error.message}</Alert>
          {job.error instanceof ApiError && job.error.status === 401 ? (
            <Link href="/" className="text-sm text-monad-soft">
              Sign in again
            </Link>
          ) : (
            <Button variant="ghost" onClick={() => job.refetch()}>
              Retry
            </Button>
          )}
        </Card>
      )}

      {!job.isError && processing && (
        <Card className="space-y-4" aria-busy>
          <div className="flex items-center gap-3">
            <Spinner className="text-monad" />
            <p className="font-semibold">Generating your video</p>
          </div>
          <div className="skeleton aspect-video w-full rounded-xl" />
          <p className="text-sm text-mute">
            {elapsed}s elapsed. Most clips take 30 to 90 seconds. You can leave this tab open.
          </p>
        </Card>
      )}

      {job.data?.status === "failed" && (
        <Card className="space-y-4">
          <Alert>{job.data.error ?? "Generation failed."}</Alert>
          <p className="text-sm text-mute">Failed generations still count toward today's limit.</p>
          <Link href="/" className="inline-block text-sm text-monad-soft">
            Try a different prompt
          </Link>
        </Card>
      )}

      {job.data?.status === "succeeded" && job.data.videoUrl && (
        <Card className="space-y-5">
          <div className="relative overflow-hidden rounded-xl bg-black">
            <video
              src={job.data.videoUrl}
              controls
              autoPlay
              loop
              playsInline
              className="aspect-video w-full object-contain"
            />
            {job.data.watermark && (
              <span className="pointer-events-none absolute bottom-12 right-3 text-sm font-semibold text-white/80 drop-shadow">
                Made with Dubu
              </span>
            )}
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-mute">Prompt</p>
            <p className="mt-1">{job.data.prompt}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button loading={download.isPending} onClick={() => download.mutate()}>
              {download.isPending ? (job.data.watermark ? "Adding watermark" : "Preparing") : "Download"}
            </Button>
            <Link href="/" className="text-sm text-mute hover:text-white">
              Make another
            </Link>
            <span className="ml-auto flex items-center gap-2 text-xs text-mute">
              <span
                aria-hidden
                className={`size-1.5 rounded-full ${job.data.tier === "holder" ? "bg-monad" : "bg-mute"}`}
              />
              {job.data.tier === "holder" ? "Holder, no watermark" : "Free, watermarked"}
            </span>
          </div>
          {download.isError && <Alert>{download.error.message}</Alert>}
        </Card>
      )}
    </div>
  );
}
