/**
 * Reads a caption into a plan, with no model involved.
 *
 * A Chog Genesis (like most PFPs) is a close-up of a face. The video model keeps the
 * first frame's framing and only animates what is already in it. So the plan answers
 * one question: can this action happen inside the picture as it is?
 *
 *  - "direct": it can (wave, wink, laugh, laser eyes, rain falling). Film the image.
 *  - "scene":  it needs a place or a prop that is not there (drive a car, surf, ride a
 *              bike, on the moon). Stage a new first frame, then film.
 *  - "body":   it needs more of the character than a face (dance, jump, run). Widen
 *              the frame, then film.
 *
 * The lists are plain words, tested in tests, and easy to extend. Anything not listed
 * stays "direct", which is today's behavior.
 */

export type Path = "direct" | "scene" | "body";

export type Plan = {
  path: Path;
  /** The words that decided the path, for the result page and the logs. */
  matched: string[];
  /** One sentence for the image editor describing the scene to set, or null for "direct". */
  stage: string | null;
};

type Rule = { re: RegExp; path: Exclude<Path, "direct">; stage?: string };

// Specific staging lines for common actions. Order matters: the first scene match wins.
const RULES: Rule[] = [
  { re: /\b(driv(e|es|ing)|drove|car|steering wheel|road trip|race car|racing)\b/, path: "scene", stage: "sitting in the driver's seat of a small car on an open road, both hands on the steering wheel, seen through the windshield" },
  { re: /\b(motorbike|motorcycle|scooter)\b/, path: "scene", stage: "riding a motorbike on a city street, hands on the handlebars" },
  { re: /\b(bike|bicycle|cycling|cycles?)\b/, path: "scene", stage: "riding a bicycle along a park path, hands on the handlebars" },
  { re: /\b(skate ?board(ing)?|skating)\b/, path: "scene", stage: "standing on a skateboard in a skate park" },
  { re: /\b(surf(s|ing)?|surfboard|wave(s)? (break|crash)|ocean wave)\b/, path: "scene", stage: "standing on a surfboard riding a big ocean wave" },
  { re: /\b(swim(s|ming)?|pool|underwater|dive|diving)\b/, path: "scene", stage: "swimming in clear blue water" },
  { re: /\b(boat|sail(s|ing)?|ship|kayak|canoe)\b/, path: "scene", stage: "sitting in a small boat on calm water" },
  { re: /\b(plane|airplane|pilot|cockpit)\b/, path: "scene", stage: "sitting in an airplane cockpit, hands on the controls, sky ahead" },
  { re: /\b(rocket|space ?ship|spaceship|astronaut|outer space|in space|on the moon|moon|mars|planet)\b/, path: "scene", stage: "in outer space in a small spacesuit, stars and a planet behind" },
  { re: /\b(horse|horseback)\b/, path: "scene", stage: "riding a horse across a field" },
  { re: /\b(train|subway|bus)\b/, path: "scene", stage: "sitting by a window inside a moving train" },
  { re: /\b(beach|sand|seaside)\b/, path: "scene", stage: "on a sunny beach with the sea behind" },
  { re: /\b(city|street|downtown|times square|tokyo|new york|lagos)\b/, path: "scene", stage: "standing on a busy city street" },
  { re: /\b(forest|jungle|woods)\b/, path: "scene", stage: "standing in a green forest" },
  { re: /\b(mountain|hiking|hike|snowboard(ing)?|ski(ing)?)\b/, path: "scene", stage: "on a snowy mountain slope" },
  { re: /\b(kitchen|cook(s|ing)?|chef)\b/, path: "scene", stage: "standing in a kitchen at a stove" },
  { re: /\b(stage|concert|guitar|drums|piano|dj)\b/, path: "scene", stage: "on a concert stage under bright lights, holding the instrument" },
  { re: /\b(basketball|football|soccer|tennis|golf|baseball)\b/, path: "scene", stage: "on a sports field holding the ball" },
  { re: /\b(gym|lift(s|ing)? weights|workout|push ?ups?)\b/, path: "scene", stage: "in a gym" },
  // Whole-body actions: the scene can stay, the frame has to show the body.
  { re: /\b(danc(e|es|ing)|twerk|moonwalk|breakdanc\w*)\b/, path: "body" },
  { re: /\b(jump(s|ing)?|hop(s|ping)?|leap(s|ing)?|backflip|flip(s|ping)?|cartwheel)\b/, path: "body" },
  { re: /\b(run(s|ning)?|jog(s|ging)?|sprint(s|ing)?|walk(s|ing)?|march(es|ing)?)\b/, path: "body" },
  { re: /\b(kick(s|ing)?|punch(es|ing)?|karate|kung fu|fight(s|ing)?)\b/, path: "body" },
  { re: /\b(spin(s|ning)?|twirl(s|ing)?|squat(s|ting)?|stretch(es|ing)?)\b/, path: "body" },
];

// Words that mean "this already fits a close-up" and should never trigger staging on
// their own, even if a scene word appears as a metaphor ("waves" the hand, not the sea).
const HAND_WAVE = /\bwav(e|es|ing)\b.*\b(paw|hand|hello|hi|bye|goodbye|at)\b|\b(paw|hand)\b.*\bwav(e|es|ing)\b/;

export function planFor(caption: string): Plan {
  const text = caption.toLowerCase();
  const matched: string[] = [];
  let scene: Rule | null = null;
  let body = false;

  for (const r of RULES) {
    const m = text.match(r.re);
    if (!m) continue;
    // "waves its paw" is a hand wave, not the ocean.
    if (r.stage?.includes("ocean wave") && HAND_WAVE.test(text)) continue;
    matched.push(m[0]);
    if (r.path === "scene" && !scene) scene = r;
    if (r.path === "body") body = true;
  }

  if (scene) return { path: "scene", matched, stage: scene.stage ?? null };
  if (body) return { path: "body", matched, stage: "standing in the same place, shown from head to toe with room to move" };
  return { path: "direct", matched, stage: null };
}

/**
 * The image-editor instruction. Identity first, then one change, then what must stay,
 * following the editor's own prompting guide. The user's sentence is included so the
 * pose matches the action that will be filmed.
 */
export function stagePrompt(plan: Plan, caption: string): string {
  const what = plan.stage ?? "in a simple scene that fits the action";
  return [
    "Keep this exact character: the same face, eyes, cheeks, colors, hair, hat, clothes and accessories, and the same flat cartoon art style with thick black outlines.",
    "Preserve facial identity.",
    `Redraw the whole picture as one wider scene where the character is ${what}, ready to ${caption.replace(/[.!?]+$/, "")}.`,
    "Show more of the character's body. Fill the empty border with the scene. No frames, no borders, no text, no extra characters.",
  ].join(" ");
}

export const STAGE_NEGATIVE = "different character, changed face, different art style, realistic photo, extra people, text, watermark, border, frame, blurry";
