/**
 * The caption interpreter. Deterministic: no model, no network.
 *
 * It splits a caption into the parts a video model follows best (subject, action,
 * setting, effects, camera) and rebuilds one clear instruction from only what the
 * user wrote. It never adds an action, place, prop, effect or camera move the user did
 * not ask for. A vague caption gets minimal, natural motion, not an invented scene.
 * The user's own words are always included verbatim as well.
 */

export type Interpretation = {
  raw: string;
  /** The requested action, without the "make my chog" lead-in and without camera words. */
  action: string | null;
  /** The first word of the action (the verb), used to check that a rewritten shot kept it. */
  verb: string | null;
  setting: string | null;
  effects: string[];
  camera: string | null;
  vague: boolean;
};

const LEAD = /^(?:please\s+)?(?:can you\s+)?(?:make|let|have|get|show)\s+(?:my|the|this|that|our|your)?\s*(?:chog|character|nft|pfp|guy|girl|cat|dog|creature|avatar|him|her|it|this|them|image|picture)?\s*(?:to\s+)?/i;
const CAMERA =
  /\b(?:the\s+)?camera\s+(?:(?:slowly|quickly|gently|smoothly)\s+)?(?:orbits?|circles?|rotates?|pans?|tilts?|zooms?|pushes?|pulls?|tracks?|follows?|dollies|moves?|spins?|flies|rises?|drops?|holds?|stays?)\b[^,.;!?]*|\b(?:(?:slow|fast|quick|smooth)\s+)?(?:zoom(?:s|ing)?\s+(?:in|out)|orbit(?:ing)?\s+(?:around|the)|pan(?:ning)?\s+(?:left|right|across)|push(?:es|ing)?\s+in|pull(?:s|ing)?\s+(?:back|out)|close[- ]up|wide shot|tracking shot|aerial shot|slow[- ]motion)\b[^,.;!?]*/i;
const EFFECTS =
  /\b(?:neon(?:\s+lights?)?|rain(?:drops)?|snow(?:flakes)?|fire|flames?|sparkles?|glitter|lightning|smoke|fog|mist|lasers?|laser eyes|glow(?:ing)?|confetti|bubbles|stars|hearts|petals|fireworks|sun ?rays|light rays|explosions?|shadows?|reflections?)\b/gi;
const PREP = /\b(?:in|on|at|through|under|inside|across|along|over|around|into|beside|near|by)\s+(?:the\s+|a\s+|an\s+|his\s+|her\s+|its\s+|their\s+)?[a-z][a-z' -]{1,40}?(?=$|,|\.|;|\bwith\b|\band\b|\bwhile\b|\bthen\b)/i;
const VAGUE =
  /^(?:look\s+)?(?:look|be|seem|feel)?\s*(?:cool|nice|awesome|epic|good|great|amazing|fun|funny|cute|alive|interesting|better|dope|fire|lit)\b|^(?:move|animate(?:\s+it|\s+this)?|do something|do anything|come alive|bring (?:it|this|him|her) to life|something cool)\b/i;

/** "wave" -> "waves", "dance energetically" -> "dances energetically", "driving" -> "is driving". Skips leading adverbs. */
export function thirdPerson(phrase: string): string {
  const words = phrase.split(" ");
  let i = 0;
  // Skip adverbs ("slowly orbit"), but not verbs that happen to end in -ly ("fly", "rely").
  const adverb = (w: string) => /^[a-z]{3,}ly$/i.test(w) && !/^(?:fly|rely|apply|reply|supply|imply|comply|multiply|rally|tally|bully)$/i.test(w);
  while (i < words.length - 1 && adverb(words[i])) i++;
  const w = words[i];
  if (!w) return phrase;
  const lw = w.toLowerCase();
  if (/ing$/.test(lw)) words[i] = `is ${w}`;
  else if (/(ss|sh|ch|x|z|o)$/.test(lw)) words[i] = `${w}es`;
  else if (/[^aeiou]y$/.test(lw)) words[i] = `${w.slice(0, -1)}ies`;
  else if (!/(s|ed)$/.test(lw)) words[i] = `${w}s`;
  return words.join(" ");
}

function tidy(s: string) {
  return s.replace(/\s+/g, " ").replace(/^[\s,;]+|[\s,;.!?]+$/g, "").trim();
}

export function interpret(caption: string): Interpretation {
  const raw = tidy(caption);
  let rest = raw.replace(LEAD, "");

  const cam = rest.match(CAMERA);
  const camera = cam ? tidy(cam[0]) : null;
  if (cam) rest = tidy(rest.replace(cam[0], " ").replace(/\b(?:and|while|as)\s*$/i, ""));

  const effects = [...new Set((rest.match(EFFECTS) ?? []).map((e) => e.toLowerCase()))];
  const prep = rest.match(PREP);
  const setting = prep ? tidy(prep[0]) : null;

  const action = rest ? tidy(rest) : null;
  // "look cool", "animate it", "make this look awesome": no concrete action was asked for.
  const vague = !action || VAGUE.test(action);
  const verb = !vague && action ? action.split(" ")[0].toLowerCase() : null;

  return { raw, action: vague ? null : action, verb, setting, effects, camera, vague };
}

/**
 * The instruction sent to the video model when the director is off or its shot is
 * rejected by the intent check. Only the user's parts, in a fixed order the model
 * follows well, plus rules that keep the character looking like the image.
 */
export function buildPrompt(i: Interpretation, traits?: string | null): string {
  const lines: string[] = [];
  if (i.vague) {
    lines.push(
      `Animate the character in the provided image with subtle, natural motion such as blinking, breathing and a small head movement, matching this request: "${i.raw}".`,
      "Do not add new objects, places or effects.",
    );
  } else if (i.action) {
    lines.push(`Animate the character in the provided image. Main action: the character ${thirdPerson(i.action)}.`);
    lines.push("The action starts in the first second and stays the main thing on screen, with clear, smooth, coherent motion.");
  } else {
    lines.push("Animate the character in the provided image with subtle, natural motion such as blinking and breathing.");
  }
  if (i.setting) lines.push(`Setting, as the user described it: ${i.setting}.`);
  if (i.effects.length) lines.push(`Visual effects the user asked for: ${i.effects.join(", ")}.`);
  const cam = i.camera?.replace(/^(?:the\s+)?camera\s+/i, "");
  lines.push(i.camera ? (/^(?:the\s+)?camera\b/i.test(i.camera) ? `Camera: the camera ${thirdPerson(cam!)}.` : `Camera: ${i.camera}.`) : "Camera: steady, no cuts.");
  lines.push(
    `Keep the character's exact appearance from the image: same face, colors, outfit, accessories and art style, and the same lighting.${traits ? ` ${traits}` : ""}`,
  );
  lines.push(`User request, word for word: "${i.raw}".`);
  return lines.join(" ");
}

/**
 * True when a rewritten shot still carries the user's action. Compares word stems so
 * "dance" matches "dances" and "dancing". A shot that dropped the action is not used.
 */
export function keepsIntent(i: Interpretation, shot: string): boolean {
  if (!i.verb) return true;
  const stem = i.verb.replace(/(ing|es|s|ed)$/, "").replace(/e$/, "");
  if (stem.length < 3) return true;
  return new RegExp(`\\b${stem.replace(/[^a-z]/g, "")}`, "i").test(shot);
}
