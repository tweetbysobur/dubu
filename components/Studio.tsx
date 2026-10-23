"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { trackJob } from "@/lib/notify";
import { LevelBadge } from "./LevelBadge";
import { StudioTour } from "./StudioTour";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type TierFacts } from "@/lib/api";
import { Alert, Button, Container, Panel } from "@/components/ui";
import { Mascot } from "@/components/Mascot";
import { ChogPicker } from "@/components/ChogPicker";
import { ImageUpload } from "@/components/ImageUpload";
import { TokenIdLoader } from "@/components/TokenIdLoader";

export function CenteredMessage({
  mood,
  title,
  children,
}: {
  mood: "idle" | "oops";
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Container className="flex justify-center py-14 sm:py-24">
      <div className="w-full max-w-md text-center sm:text-left">
        <Mascot mood={mood} size={120} className="mx-auto h-auto w-24 sm:mx-0 sm:w-28" />
        <h1 className="mt-5 font-display text-3xl font-extrabold tracking-[-0.035em] sm:text-4xl">{title}</h1>
        {children}
      </div>
    </Container>
  );
}

export function Studio({ me }: { me: Me }) {
  const router = useRouter();
  const qc = useQueryClient();
  const holder = me.tier === "holder";

  const [tokens, setTokens] = useState(me.tokens);
  const [tokenId, setTokenId] = useState<string | null>(me.tokens[0]?.tokenId ?? null);
  // Arriving from Profile with a Chog picked: start with that one.
  useEffect(() => {
    const want = new URLSearchParams(window.location.search).get("chog");
    if (want && me.tokens.some((t) => t.tokenId === want)) setTokenId(want);
  }, [me.tokens]);
  const [upload, setUpload] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const tiers = useQuery<TierFacts>({ queryKey: ["tiers"], queryFn: () => api<TierFacts>("/api/tiers") });
  const directorOn = !!tiers.data?.director;
  const [directing, setDirecting] = useState(true);

  const hasChog = holder && tokens.length > 0;
  const activeChog = tokens.find((t) => t.tokenId === tokenId) ?? tokens[0];
  const remaining = Math.max(0, me.limit - me.used);
  const promptOk = prompt.trim().length >= 3 && prompt.length <= 500;
  const imageOk = hasChog || !!upload;

  const generate = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt,
          direct: directorOn && directing,
          ...(hasChog ? { tokenId: activeChog?.tokenId } : { image: upload }),
        }),
      }),
    onSuccess: ({ id }) => {
      trackJob(id); // announced with a notification when it finishes, wherever the user is
      qc.invalidateQueries({ queryKey: ["me"] });
      router.push(`/result/${encodeURIComponent(id)}`);
    },
  });

  const blocker =
    remaining === 0
      ? "No videos left today"
      : !imageOk
        ? holder
          ? "Load your Chog first"
          : "Add an image first"
        : !promptOk
          ? "Say what it should do first"
          : null;

  return (
    <main>
      <Container className="py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">
              Make a video
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-mute">
              <LevelBadge tier={me.tier} size="sm" />
              {me.watermark ? `${me.quality} with a small watermark.` : `${me.quality}, no watermark.`}
            </p>
          </div>
          <p className="text-mute">
            <span className="font-display text-3xl font-extrabold tabular-nums text-ink">{remaining}</span>
            <span className="tabular-nums"> of {me.limit} videos left today</span>
          </p>
        </div>

        {me.mock && (
          <div className="mt-6">
            <Alert tone="info">Demo mode is on, so Dubu returns a sample clip instead of your video.</Alert>
          </div>
        )}

        <TourPanel chog={hasChog && activeChog ? { src: activeChog.image, id: activeChog.tokenId } : null} />

        <div className="mt-6 grid items-start gap-5 md:grid-cols-2 md:gap-6">
          <Panel>
            <h2 className="font-display text-xl font-bold tracking-[-0.02em]">{holder ? "Your Chog" : "Image"}</h2>
            <div className="mt-5">
              {hasChog ? (
                <ChogPicker tokens={tokens} selected={tokenId} onSelect={setTokenId} />
              ) : holder ? (
                <TokenIdLoader
                  onLoaded={(t) => {
                    setTokens([t]);
                    setTokenId(t.tokenId);
                    qc.invalidateQueries({ queryKey: ["me"] }); // remembered for next time
                  }}
                />
              ) : (
                <>
                  <ImageUpload value={upload} onChange={setUpload} />
                  <p className="mt-4 text-sm leading-relaxed text-mute">
                    {me.tier === "token" ? "Hold a Chog Genesis NFT too? " : me.chog.min ? "Hold a Chog Genesis NFT or CHOG? " : "Hold a Chog Genesis NFT? "}
                    <Link href="/profile" className="font-semibold text-brand hover:text-brand-press">
                      Link its wallet
                    </Link>{" "}
                    {me.tier === "token" ? "and Dubu loads your Chog in." : "to unlock more."}
                  </p>
                </>
              )}
            </div>
          </Panel>

          <Panel className="md:sticky md:top-24">
            <label htmlFor="prompt" className="block font-display text-xl font-bold tracking-[-0.02em]">
              {hasChog ? "What should your Chog do?" : "What should it do?"}
            </label>
            <p className="mt-1 text-sm text-mute">Say the action, plus any details you care about: where, which paw, how it feels.</p>
            <textarea
              id="prompt"
              rows={5}
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="waves with its left paw, then does a little happy dance in the rain"
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-white px-4 py-3.5 text-base leading-relaxed outline-none placeholder:text-mute/70 focus:border-brand"
            />
            <p className="mt-2 text-right text-xs tabular-nums text-mute">{prompt.length}/500</p>
            {directorOn && (
              <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-3.5">
                <input
                  type="checkbox"
                  checked={directing}
                  onChange={(e) => setDirecting(e.target.checked)}
                  className="mt-0.5 size-5 shrink-0 accent-[#1F4FFF]"
                />
                <span className="text-sm leading-relaxed">
                  <span className="font-semibold">Let Dubu direct the shot</span>
                  <span className="block text-mute">
                    Dubu turns your sentence into a full shot: one action, a camera move, light and mood
                    {hasChog ? ", and your Chog's traits" : ""}. You see it with your video.
                  </span>
                </span>
              </label>
            )}
            <Button
              size="lg"
              className="mt-4 w-full"
              loading={generate.isPending}
              disabled={!!blocker}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? (directorOn && directing ? "Directing the shot" : "Starting your video") : (blocker ?? "Make my video")}
            </Button>
            <p className="mt-3 text-center text-sm text-mute">
              Keep it friendly: no nudity, sexual content, gore or hate.{" "}
              <Link href="/docs#rules" className="font-medium text-brand underline-offset-4 hover:underline">
                Content rules
              </Link>
            </p>
            {generate.isError && (
              <div className="mt-4">
                <Alert>{generate.error.message}</Alert>
              </div>
            )}
          </Panel>
        </div>
      </Container>
    </main>
  );
}

const TOUR_KEY = "dubu.tour";

/** The walkthrough, open on first visit, folded away once someone hides it. */
function TourPanel({ chog }: { chog: { src: string; id: string } | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(TOUR_KEY) !== "hidden");
    } catch {
      setOpen(true);
    }
  }, []);
  const showcase = useQuery<{ enabled: boolean; ids: string[] }>({
    queryKey: ["showcase"],
    queryFn: () => api("/api/showcase"),
    staleTime: Infinity,
    enabled: !chog,
  });
  const sampleId = showcase.data?.enabled ? showcase.data.ids[1] ?? showcase.data.ids[0] : null;
  const src = chog?.src ?? (sampleId ? `/api/chogs/${sampleId}/image` : null);
  const id = chog?.id ?? sampleId ?? "1";

  function toggle(next: boolean) {
    setOpen(next);
    try {
      localStorage.setItem(TOUR_KEY, next ? "open" : "hidden");
    } catch {
      // storage blocked: the choice lasts for this visit
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={() => toggle(true)} className="mt-6 inline-flex h-11 items-center gap-2 text-sm font-semibold text-brand hover:text-brand-press">
        <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 5v14l11-7z" />
        </svg>
        Watch how it works
      </button>
    );
  }
  return (
    <Panel className="mt-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold tracking-[-0.02em]">How it works</h2>
          <p className="mt-1 text-sm text-mute">{chog ? "Your Chog, from idea to download." : "A Chog Genesis, from idea to download."} A walkthrough, not a real result.</p>
        </div>
        <button type="button" onClick={() => toggle(false)} className="h-10 shrink-0 rounded-xl px-3 text-sm font-semibold text-mute hover:bg-surface hover:text-ink">
          Hide
        </button>
      </div>
      <div className="mt-5">
        <StudioTour chogSrc={src} chogId={id} />
      </div>
    </Panel>
  );
}
