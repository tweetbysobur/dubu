"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me } from "@/lib/api";
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
  const [upload, setUpload] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  const hasChog = holder && tokens.length > 0;
  const activeChog = tokens.find((t) => t.tokenId === tokenId) ?? tokens[0];
  const remaining = Math.max(0, me.limit - me.used);
  const promptOk = prompt.trim().length >= 3 && prompt.length <= 500;
  const imageOk = hasChog || !!upload;

  const generate = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/generate", {
        method: "POST",
        body: JSON.stringify(hasChog ? { prompt, tokenId: activeChog?.tokenId } : { prompt, image: upload }),
      }),
    onSuccess: ({ id }) => {
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
          ? "Describe the scene first"
          : null;

  return (
    <main>
      <Container className="py-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div>
            <h1 className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.04em] sm:text-5xl">
              Make a video
            </h1>
            <p className="mt-2 flex items-center gap-2 text-mute">
              <span aria-hidden className={`size-2 rounded-full ${holder ? "bg-brand" : "bg-mute"}`} />
              {holder
                ? `Holder mode. ${me.quality}, no watermark.`
                : `Free mode. ${me.quality} with a small watermark.`}
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

        <div className="mt-8 grid items-start gap-5 md:grid-cols-2 md:gap-6">
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
                  }}
                />
              ) : (
                <>
                  <ImageUpload value={upload} onChange={setUpload} />
                  <p className="mt-4 text-sm leading-relaxed text-mute">
                    Hold a Chog Genesis NFT?{" "}
                    <Link href="/profile" className="font-semibold text-brand hover:text-brand-press">
                      Link its wallet
                    </Link>{" "}
                    to skip this step and unlock holder mode.
                  </p>
                </>
              )}
            </div>
          </Panel>

          <Panel className="md:sticky md:top-24">
            <label htmlFor="prompt" className="block font-display text-xl font-bold tracking-[-0.02em]">
              Describe the scene
            </label>
            <p className="mt-1 text-sm text-mute">One sentence is enough.</p>
            <textarea
              id="prompt"
              rows={5}
              maxLength={500}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="dancing in the rain"
              className="mt-4 w-full resize-none rounded-2xl border border-line bg-white px-4 py-3.5 text-base leading-relaxed outline-none placeholder:text-mute/70 focus:border-brand"
            />
            <p className="mt-2 text-right text-xs tabular-nums text-mute">{prompt.length}/500</p>
            <Button
              size="lg"
              className="mt-4 w-full"
              loading={generate.isPending}
              disabled={!!blocker}
              onClick={() => generate.mutate()}
            >
              {generate.isPending ? "Starting your video" : (blocker ?? "Make my video")}
            </Button>
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
