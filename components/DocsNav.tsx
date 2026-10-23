"use client";

import { useEffect, useState } from "react";

export type DocsGroup = { title: string; items: { id: string; title: string }[] };

/** Grouped contents for the docs. Marks the section being read; on phones it folds into one menu. */
export function DocsNav({ groups }: { groups: DocsGroup[] }) {
  const ids = groups.flatMap((g) => g.items.map((i) => i.id));
  const [active, setActive] = useState(ids[0]);

  useEffect(() => {
    const els = ids.map((id) => document.getElementById(id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (seen[0]) setActive(seen[0].target.id);
      },
      { rootMargin: "-96px 0px -65% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
    // ids come from a fixed list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = (onPick?: () => void) => (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.title}>
          <p className="text-[13px] font-semibold text-ink">{g.title}</p>
          <ul className="mt-2 space-y-0.5 border-l border-line">
            {g.items.map((i) => {
              const on = i.id === active;
              return (
                <li key={i.id}>
                  <a
                    href={`#${i.id}`}
                    onClick={onPick}
                    aria-current={on ? "location" : undefined}
                    className={`-ml-px flex min-h-9 items-center border-l-2 pl-3.5 text-[15px] transition-colors ${
                      on ? "border-brand font-semibold text-brand" : "border-transparent text-mute hover:border-mute/40 hover:text-ink"
                    }`}
                  >
                    {i.title}
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );

  const current = groups.flatMap((g) => g.items).find((i) => i.id === active)?.title;

  return (
    <>
      <details className="group rounded-2xl border border-line bg-white md:hidden">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 text-[15px] font-semibold">
          <span>
            Contents <span className="font-medium text-mute">· {current}</span>
          </span>
          <svg aria-hidden width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="transition-transform group-open:rotate-180">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </summary>
        <div className="border-t border-line px-4 py-4">
          {list(() => document.querySelector<HTMLDetailsElement>("details[open]")?.removeAttribute("open"))}
        </div>
      </details>
      <nav aria-label="Docs contents" className="hidden md:block">
        {list()}
      </nav>
    </>
  );
}
