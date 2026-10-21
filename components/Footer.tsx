import Link from "next/link";
import { Logo } from "./Logo";
import { Container } from "./ui";

const links = [
  { href: "/", label: "Studio" },
  { href: "/profile", label: "Profile" },
  { href: "/faq", label: "FAQ" },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <Container className="py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Logo size="sm" />
            <p className="mt-2 text-sm text-mute">Your Chog, in motion.</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-1 gap-y-1 sm:justify-end">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="-mx-1 inline-flex h-11 items-center rounded-xl px-3 text-[15px] font-medium text-mute hover:bg-surface hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 flex flex-col gap-2 border-t border-line pt-6 text-sm text-mute sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Dubu</p>
          <p>Runs on Monad mainnet</p>
        </div>
      </Container>
    </footer>
  );
}
