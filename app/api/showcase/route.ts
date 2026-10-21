import { NextResponse } from "next/server";
import { TOKEN_ID } from "@/lib/chog";

export const dynamic = "force-dynamic";

// A spread across the 1,969 Chog Genesis. Override with SHOWCASE_CHOG_IDS="1,2,3".
const DEFAULT_IDS = ["7", "42", "111", "256", "333", "420", "512", "777", "888", "1024", "1337", "1969"];

/** Which Chogs the landing page shows. Images come from /api/chogs/:id/image. */
export function GET() {
  const configured = (process.env.SHOWCASE_CHOG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => TOKEN_ID.test(s));
  const ids = (configured.length ? configured : DEFAULT_IDS).slice(0, 16);
  return NextResponse.json(
    { enabled: Boolean(process.env.CHOG_CONTRACT_ADDRESS), ids },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" } },
  );
}
