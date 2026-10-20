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
      <label htmlFor="token-id" className="block text-sm text-mute">
        Enter the token ID of a Chog you hold. We check it against your wallet onchain.
      </label>
      <div className="flex gap-2">
        <input
          id="token-id"
          inputMode="numeric"
          autoComplete="off"
          value={id}
          onChange={(e) => setId(e.target.value.replace(/\D/g, "").slice(0, 7))}
          placeholder="Token ID"
          className="h-11 w-36 rounded-xl border border-line bg-ink px-4 text-sm tabular-nums outline-none focus:border-monad"
        />
        <Button type="submit" variant="ghost" disabled={!valid} loading={load.isPending}>
          {load.isPending ? "Checking" : "Load Chog"}
        </Button>
      </div>
      {load.isError && <Alert>{load.error.message}</Alert>}
    </form>
  );
}
