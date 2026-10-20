"use client";

import type { Me } from "@/lib/api";

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

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={active.image}
        alt={active.name}
        className="aspect-square w-full max-w-60 rounded-xl border border-monad/50 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{active.name}</p>
        {active.traits.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {active.traits.map((t) => (
              <li key={t.trait_type} className="rounded-lg border border-line px-2 py-1 text-xs">
                <span className="text-mute">{t.trait_type}:</span> {t.value}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-mute">No traits found in metadata.</p>
        )}
        <p className="mt-3 text-xs text-mute">Traits are added to your prompt so the video keeps your Chog's look.</p>

        {tokens.length > 1 && (
          <div className="mt-4 flex gap-2" role="radiogroup" aria-label="Choose a Chog">
            {tokens.map((t) => (
              <button
                key={t.tokenId}
                role="radio"
                aria-checked={t.tokenId === active.tokenId}
                onClick={() => onSelect(t.tokenId)}
                className={`size-12 overflow-hidden rounded-lg border-2 ${
                  t.tokenId === active.tokenId ? "border-monad" : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.image} alt={t.name} className="size-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
