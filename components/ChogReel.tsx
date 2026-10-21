"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Container } from "./ui";

type Showcase = { enabled: boolean; ids: string[] };

/** A slow reel of Chog Genesis art, served through Dubu's own image route. */
export function ChogReel() {
  const showcase = useQuery<Showcase>({ queryKey: ["showcase"], queryFn: () => api<Showcase>("/api/showcase"), staleTime: Infinity });
  const [broken, setBroken] = useState<Set<string>>(new Set());

  if (!showcase.data?.enabled) return null;
  const ids = showcase.data.ids.filter((id) => !broken.has(id));
  if (ids.length < 3) return null;

  const tile = (id: string, copy: boolean) => (
    <li
      key={`${copy ? "b" : "a"}-${id}`}
      className={`mr-4 w-36 shrink-0 sm:mr-5 sm:w-48 ${copy ? "motion-reduce:hidden" : ""}`}
      aria-hidden={copy || undefined}
    >
      <div className="aspect-square overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/chogs/${id}/image`}
          alt={copy ? "" : `Chog Genesis #${id}`}
          loading="lazy"
          decoding="async"
          className="size-full object-cover"
          onError={() => setBroken((b) => new Set(b).add(id))}
        />
      </div>
      <p className="mt-2 text-sm font-medium tabular-nums text-mute">#{id}</p>
    </li>
  );

  return (
    <section aria-labelledby="chogs-heading" className="border-b border-line py-14 sm:py-20">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 id="chogs-heading" className="font-display text-[34px] font-extrabold leading-tight tracking-[-0.035em] sm:text-[44px]">
            Meet the Chogs
          </h2>
          <p className="max-w-[26rem] leading-relaxed text-mute">
            1,969 Chog Genesis live on Monad. Hold one and it stars in your videos.
          </p>
        </div>
      </Container>
      {/* Margins, not gap, so one copy is exactly half the row and the loop has no jump. */}
      <div className="dubu-reel-wrap mt-8 overflow-hidden pl-4 motion-reduce:overflow-x-auto sm:mt-10 sm:pl-6">
        <ul className="dubu-reel flex w-max">
          {ids.map((id) => tile(id, false))}
          {ids.map((id) => tile(id, true))}
        </ul>
      </div>
    </section>
  );
}
