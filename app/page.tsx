"use client";

import { useSession } from "@/lib/useSession";
import { Alert, Button, Container, Spinner } from "@/components/ui";
import { Landing } from "@/components/Landing";
import { CenteredMessage, Studio } from "@/components/Studio";

export default function Home() {
  const session = useSession();
  const { state, me, meError, refetch, walletSignIn, signOut } = session;

  if (state === "signed-out") return <Landing session={session} />;

  if (state === "loading") {
    return (
      <Container className="py-10 sm:py-14" aria-busy>
        <p className="text-sm text-mute">Loading your studio</p>
        <div className="skeleton mt-4 h-12 w-64 rounded-2xl" />
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <div className="skeleton h-80 rounded-3xl" />
          <div className="skeleton h-80 rounded-3xl" />
        </div>
      </Container>
    );
  }

  if (state === "wallet-signing") {
    return (
      <CenteredMessage mood="idle" title="Confirm in your wallet">
        <p className="mt-3 leading-relaxed text-mute">
          Your wallet shows a sign-in message. Signing it proves the wallet is yours. It is not a transaction and costs
          no gas.
        </p>
        {walletSignIn.isPending ? (
          <p className="mt-7 flex items-center justify-center gap-3 font-medium sm:justify-start">
            <Spinner className="text-brand" /> Waiting for your wallet
          </p>
        ) : (
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" onClick={() => walletSignIn.mutate()}>
              Sign message
            </Button>
            <Button size="lg" variant="ghost" onClick={() => signOut.mutate()}>
              Use a passkey instead
            </Button>
          </div>
        )}
        {walletSignIn.isError && !walletSignIn.isPending && (
          <div className="mt-4">
            <Alert>{walletSignIn.error.message}</Alert>
          </div>
        )}
      </CenteredMessage>
    );
  }

  if (state === "error") {
    return (
      <CenteredMessage mood="oops" title="Dubu could not load your studio">
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
