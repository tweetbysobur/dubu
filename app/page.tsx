"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/useSession";
import { Landing } from "@/components/Landing";

/** The landing page, for everyone. Signing in here goes straight to the studio. */
export default function Home() {
  const session = useSession();
  const router = useRouter();
  const wasSignedOut = useRef(false);

  useEffect(() => {
    if (session.state === "signed-out") wasSignedOut.current = true;
    // A wallet waiting to sign, or a sign-in that just finished on this page.
    if (session.state === "wallet-signing" || (session.state === "ready" && wasSignedOut.current)) {
      router.push("/studio");
    }
  }, [session.state, router]);

  return <Landing session={session} />;
}
