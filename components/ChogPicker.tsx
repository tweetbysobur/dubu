"use client";

import { useState } from "react";
import type { Me } from "@/lib/api";
import { ChogFrame } from "./ChogFrame";

export function ChogPicker({
  tokens,
  selected,
  onSelect,
}: {
  tokens: Me["tokens"];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const active = tokens.find((t) => t.tokenId === selected) ?? tokens[0];
  // Served through Dubu with backup IPFS gateways; the raw metadata URL is the fallback.
  const [direct, setDirect] = useState<Set<string>>(new Set());
  const imgSrc = (t: Me["tokens"][number]) => (direct.has(t.tokenId) ? t.image : `/api/chogs/${encodeURIComponent(t.tokenId)}/image`);
  const fallback = (t: Me["tokens"][number]) => setDirect((d) => (d.has(t.tokenId) ? d : new Set(d).add(t.tokenId)));

  return (
    <div>
      {/* Through the viewfinder: this is the Chog Dubu is about to film. */}
      <ChogFrame tokenId={active.tokenId} src={imgSrc(active)} alt={active.name} size="lg" onError={() => fallback(active)} />
      <p className="mt-4 font-display text-lg font-bold tracking-[-0.01em]">{active.name}</p>

      {active.traits.length > 0 ? (
        <>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {active.traits.map((t) => (
              <div key={t.trait_type} className="min-w-0">
                <dt className="text-mute">{t.trait_type}</dt>
                <dd className="truncate font-medium">{t.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-mute">Dubu adds these traits to your prompt to keep your Chog's look.</p>
        </>
      ) : (
        <p className="mt-2 text-sm text-mute">No traits found in this Chog's metadata.</p>
      )}

      {tokens.length > 1 && (
        <div className="mt-5 flex flex-wrap gap-2" role="radiogroup" aria-label="Choose a Chog">
          {tokens.map((t) => {
            const on = t.tokenId === active.tokenId;
            return (
              <button
                key={t.tokenId}
                type="button"
                role="radio"
                aria-checked={on}
                aria-label={t.name}
                onClick={() => onSelect(t.tokenId)}
                className={`size-14 overflow-hidden rounded-xl border-2 ${on ? "border-brand" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imgSrc(t)} alt="" className="size-full object-cover" onError={() => fallback(t)} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
