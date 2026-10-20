"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "@/lib/useSession";
import { api, type Me } from "@/lib/api";
import { Alert, Button, Card } from "@/components/ui";
import { ChogPicker } from "@/components/ChogPicker";
import { ImageUpload } from "@/components/ImageUpload";
import { TokenIdLoader } from "@/components/TokenIdLoader";

type TierFacts = Record<"holder" | "free", { quality: string; watermark: boolean; limit: number }>;

export default function Home() {
  const { state, me, meError, refetch, signIn } = useSession();

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Turn your Chog into a video.</h1>
        <p className="mt-2 text-mute">Pick an image, write a prompt, get a short clip. Chog holders get the full studio.</p>
      </section>

      {state === "disconnected" && (
        <Card className="flex flex-col items-start gap-4">
          <TierCompare />
          <ConnectButton label="Connect wallet to start" />
        </Card>
      )}

      {(state === "connecting" || state === "checking") && <LoadingCard label={state === "connecting" ? "Connecting wallet" : "Checking your wallet for Chogs"} />}

      {state === "needs-signature" && (
        <Card className="space-y-4">
          <div>
            <h2 className="font-semibold">Verify your wallet</h2>
            <p className="mt-1 text-sm text-mute">Sign a free message so we can confirm you own this wallet. No gas, no transaction.</p>
          </div>
          <Button loading={signIn.isPending} onClick={() => signIn.mutate()}>
            {signIn.isPending ? "Waiting for signature" : "Sign and continue"}
          </Button>
          {signIn.isError && <Alert>{signIn.error.message}</Alert>}
        </Card>
      )}

      {state === "error" && (
        <Card className="space-y-4">
          <Alert>{meError?.message ?? "Something went wrong."}</Alert>
          <Button variant="ghost" onClick={() => refetch()}>
            Try again
          </Button>
        </Card>
      )}

      {state === "ready" && me && <Studio me={me} />}
    </div>
  );
}

function LoadingCard({ label }: { label: string }) {
  return (
    <Card className="space-y-3" aria-busy>
      <p className="text-sm text-mute">{label}...</p>
      <div className="skeleton h-40 rounded-xl" />
      <div className="skeleton h-11 w-40 rounded-xl" />
    </Card>
  );
}

function TierCompare() {
  const tiers = useQuery<TierFacts>({ queryKey: ["tiers"], queryFn: () => api<TierFacts>("/api/tiers") });
  const t = tiers.data;
  const rows = [
    ["Image", "Your Chog, auto-loaded", "Upload any image"],
    ["Prompt", "Uses your Chog's traits", "Plain"],
    ["Quality", t?.holder.quality ?? "-", t?.free.quality ?? "-"],
    ["Per day", t ? String(t.holder.limit) : "-", t ? String(t.free.limit) : "-"],
    ["Watermark", t ? (t.holder.watermark ? "Yes" : "None") : "-", t ? (t.free.watermark ? "Yes" : "None") : "-"],
  ];
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-mute">
          <th className="pb-2 font-normal" />
          <th className="pb-2 font-semibold text-monad-soft">Chog holder</th>
          <th className="pb-2 font-normal">Everyone else</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([k, h, f]) => (
          <tr key={k} className="border-t border-line">
            <td className="py-2 text-mute">{k}</td>
            <td className="py-2">{h}</td>
            <td className="py-2 text-mute">{f}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Studio({ me }: { me: Me }) {
  const router = useRouter();
  const qc = useQueryClient();
  const holder = me.tier === "holder";
  const [tokens, setTokens] = useState(me.tokens);
  const hasChogImage = holder && tokens.length > 0;

  const [tokenId, setTokenId] = useState<string | null>(me.tokens[0]?.tokenId ?? null);
  const [upload, setUpload] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");

  const remaining = Math.max(0, me.limit - me.used);
  const promptOk = prompt.trim().length >= 3 && prompt.length <= 500;
  const imageOk = hasChogImage || !!upload;

  const generate = useMutation({
    mutationFn: () =>
      api<{ id: string }>("/api/generate", {
        method: "POST",
        body: JSON.stringify(hasChogImage ? { prompt, tokenId } : { prompt, image: upload }),
      }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["me"] });
      router.push(`/result/${encodeURIComponent(id)}`);
    },
  });

  const blocker = remaining === 0 ? "Daily limit reached" : !imageOk ? "Add an image" : !promptOk ? "Write a prompt" : null;

  return (
    <div className="space-y-6">
      <div
        className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-5 py-4 ${
          holder ? "border-monad/60 bg-monad/10" : "border-line bg-panel"
        }`}
      >
        <div>
          <p className={`font-semibold ${holder ? "text-monad-soft" : ""}`}>{holder ? "Holder mode unlocked" : "Free mode"}</p>
          <p className="text-sm text-mute">
            {holder
              ? `Your Chog, ${me.quality}, no watermark.`
              : `${me.quality} with watermark. Hold a Chog to unlock the full studio.`}
          </p>
        </div>
        <p className="text-sm tabular-nums">
          <span className="font-semibold">{remaining}</span>
          <span className="text-mute"> / {me.limit} left today</span>
        </p>
      </div>

      {me.mock && <Alert tone="info">Demo mode: no video API key set, so you get a sample clip.</Alert>}

      <Card className="space-y-4">
        <h2 className="font-semibold">1. Image</h2>
        {hasChogImage ? (
          <ChogPicker tokens={tokens} selected={tokenId} onSelect={setTokenId} />
        ) : holder ? (
          <TokenIdLoader
            onLoaded={(t) => {
              setTokens([t]);
              setTokenId(t.tokenId);
            }}
          />
        ) : (
          <ImageUpload value={upload} onChange={setUpload} />
        )}
      </Card>

      <Card className="space-y-4">
        <label htmlFor="prompt" className="block font-semibold">
          2. Prompt
        </label>
        <textarea
          id="prompt"
          rows={3}
          maxLength={500}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="my Chog riding a rocket through a neon city"
          className="w-full resize-none rounded-xl border border-line bg-ink px-4 py-3 text-sm outline-none placeholder:text-mute/60 focus:border-monad"
        />
        <p className="text-right text-xs tabular-nums text-mute">{prompt.length}/500</p>
      </Card>

      <div className="space-y-3">
        <Button
          className="w-full sm:w-auto"
          loading={generate.isPending}
          disabled={!!blocker}
          onClick={() => generate.mutate()}
        >
          {generate.isPending ? "Starting generation" : (blocker ?? "Generate video")}
        </Button>
        {generate.isError && <Alert>{generate.error.message}</Alert>}
      </div>
    </div>
  );
}
