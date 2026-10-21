"use client";

import { useSession } from "@/lib/useSession";
import { Alert, Button, Container } from "@/components/ui";
import { Landing } from "@/components/Landing";
import { CenteredMessage, Studio } from "@/components/Studio";

export default function Home() {
  const { state, me, meError, refetch, signIn } = useSession();

  if (state === "disconnected") return <Landing />;

  if (state === "connecting" || state === "checking") {
    return (
      <Container className="py-10 sm:py-14" aria-busy>
        <p className="text-sm text-mute">{state === "connecting" ? "Connecting your wallet" : "Checking your wallet for a Chog"}</p>
        <div className="skeleton mt-4 h-12 w-64 rounded-2xl" />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="skeleton h-80 rounded-3xl" />
          <div className="skeleton h-80 rounded-3xl" />
        </div>
      </Container>
    );
  }

  if (state === "needs-signature") {
    return (
      <CenteredMessage mood="idle" title="Sign in to Dubu">
        <p className="mt-3 leading-relaxed text-mute">
          Sign a free message to prove this wallet is yours. It is not a transaction and costs no gas.
        </p>
        <Button size="lg" className="mt-7 w-full sm:w-auto" loading={signIn.isPending} onClick={() => signIn.mutate()}>
          {signIn.isPending ? "Waiting for your wallet" : "Sign message"}
        </Button>
        {signIn.isError && (
          <div className="mt-4">
            <Alert>{signIn.error.message}</Alert>
          </div>
        )}
      </CenteredMessage>
    );
  }

  if (state === "error") {
    return (
      <CenteredMessage mood="oops" title="Dubu could not load your wallet">
        <div className="mt-4">
          <Alert>{meError?.message ?? "Something went wrong."}</Alert>
        </div>
        <Button variant="ghost" className="mt-5" onClick={() => refetch()}>
          Try again
        </Button>
      </CenteredMessage>
    );
  }

  return me ? <Studio me={me} /> : null;
}

