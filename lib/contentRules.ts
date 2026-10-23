/**
 * Content rules for captions. Dubu is for fun, creative videos. A caption that asks for
 * nudity or sexual content, graphic violence or self-harm, or hate is refused before
 * anything is made, and the refusal never uses a daily video.
 *
 * Deterministic on purpose: the same words always get the same answer, with no model
 * call. Matching is on whole words after light normalising (case, accents, common
 * letter swaps like 0 for o, and letters split by spaces or dots), so "n.u.d.e" and
 * "NUD3" are caught while "stripes" or "shooting a video" are not.
 *
 * Images are screened separately, by the director, when it is on.
 */

export type RuleCategory = "sexual" | "violence" | "hate";

const RULES: { category: RuleCategory; patterns: RegExp[] }[] = [
  {
    category: "sexual",
    patterns: [
      /\bnud(e|es|ity|ist)\b/,
      /\bnaked\b/,
      /\bnsfw\b/,
      /\bporn\w*\b/,
      /\bsex(y|ual|ually|ier|iest)?\b/,
      /\berotic\w*\b/,
      /\bxxx\b/,
      /\b(topless|bottomless)\b/,
      /\bundress\w*\b/,
      /\bstrip(tease|per|pers|ping naked| naked| down to)\b/,
      /\blingerie\b/,
      /\bonlyfans\b/,
      /\b(boob|boobs|tits|titties|nipple|nipples|genital|genitals|penis|vagina|dick|cock|pussy)\b/,
      /\b(orgasm|masturbat\w*|fetish\w*|hentai|lewd)\b/,
      /\b(make out|making out|twerk\w*)\b/,
      /\bin (a )?(bikini|underwear|panties)\b/,
    ],
  },
  {
    category: "violence",
    patterns: [
      /\b(gore|gory)\b/,
      /\b(decapitat|dismember|disembowel|mutilat|behead)\w*\b/,
      /\bblood (bath|everywhere|splatter\w*|spray\w*|gushing)\b/,
      /\bbloodbath\b/,
      /\btortur\w*\b/,
      /\b(suicide|self harm|self-harm|kill (himself|herself|itself|themselves|yourself))\b/,
      /\b(hang(ed|s|ing)? (himself|herself|itself|themselves)|slit\w* (his|her|its|their) (throat|wrist))\b/,
      /\b(shoot\w*|stab\w*|kill\w*|murder\w*) (a |the )?(child|children|kid|kids|baby|people|person|crowd)\b/,
    ],
  },
  {
    category: "hate",
    patterns: [/\b(nazi\w*|swastika\w*|kkk|ku klux|white power|heil hitler|sieg heil|ethnic cleansing|genocide)\b/],
  },
];

/** Lowercase, strip accents, undo common swaps, join letters split by spaces, dots or dashes. */
function normalise(text: string): string {
  let s = text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  s = s.replace(/[0134578@$]/g, (c) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s" })[c] ?? c);
  // n.u.d.e / n u d e / n-u-d-e: single letters joined by separators become one word
  s = s.replace(/\b(?:[a-z][\s.\-_*]){2,}[a-z]\b/g, (m) => m.replace(/[\s.\-_*]/g, ""));
  return s.replace(/[^a-z\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

export function checkCaption(text: string): { ok: true } | { ok: false; category: RuleCategory; message: string } {
  const s = normalise(text);
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(s))) return { ok: false, category: rule.category, message: MESSAGES[rule.category] };
  }
  return { ok: true };
}

const MESSAGES: Record<RuleCategory, string> = {
  sexual: "Dubu does not make nude or sexual videos. Try a different idea. This one did not count.",
  violence: "Dubu does not make gory, violent or self-harm videos. Try a different idea. This one did not count.",
  hate: "Dubu does not make hateful videos. Try a different idea. This one did not count.",
};
