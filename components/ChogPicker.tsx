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
    <div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={active.image} alt={active.name} className="aspect-square w-full rounded-2xl bg-surface object-cover" />
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
                <img src={t.image} alt="" className="size-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
