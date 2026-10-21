"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, type Me } from "@/lib/api";
import { Alert, Button } from "./ui";

type Token = Me["tokens"][number];

export function TokenIdLoader({ onLoaded }: { onLoaded: (t: Token) => void }) {
  const [id, setId] = useState("");
  const valid = /^\d{1,7}$/.test(id);

  const load = useMutation({
    mutationFn: () => api<Token>(`/api/token/${id}`),
    onSuccess: onLoaded,
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) load.mutate();
      }}
    >
      <label htmlFor="token-id" className="block leading-relaxed text-mute">
        Your wallet holds a Chog, but Dubu could not list it. Enter its token ID and Dubu checks it against your wallet
        onchain.
      </label>
      <div className="flex gap-2">
        <input
          id="token-id"
          inputMode="numeric"
          autoComplete="off"
          value={id}
          onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder="Token ID, e.g. 1906"
          className="h-11 min-w-0 flex-1 rounded-2xl border border-line bg-white px-4 text-base tabular-nums outline-none placeholder:text-mute/70 focus:border-brand"
        />
        <Button type="submit" disabled={!valid} loading={load.isPending}>
          {load.isPending ? "Checking" : "Load Chog"}
        </Button>
      </div>
      {load.isError && <Alert>{load.error.message}</Alert>}
    </form>
  );
}
