import type { Metadata } from "next";
import { Faq } from "@/components/Faq";
import { Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "Questions | Dubu",
  description: "How Dubu works: passkeys, holder mode, linked wallets, video length and watermarks.",
};

export default function FaqPage() {
  return (
    <main>
      <Container className="max-w-3xl py-10 sm:py-16">
        <Faq headingLevel="h1" />
      </Container>
    </main>
  );
}
