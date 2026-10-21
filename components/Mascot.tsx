export type Mood = "idle" | "rolling" | "done" | "oops";

const INK = "#0B1220";
const BLUE = "#1F4FFF";
const LENS = "#8FA8FF";
const CHEEK = "#5C7DFF";

const LABELS: Record<Mood, string> = {
  idle: "Dubu the handycam, smiling",
  rolling: "Dubu the handycam, filming",
  done: "Dubu the handycam, happy",
  oops: "Dubu the handycam, worried",
};

function Body() {
  return (
    <>
      <rect x="62" y="148" width="11" height="24" rx="5.5" fill={INK} />
      <rect x="104" y="148" width="11" height="24" rx="5.5" fill={INK} />
      <ellipse cx="67.5" cy="173" rx="10" ry="5" fill={INK} />
      <ellipse cx="109.5" cy="173" rx="10" ry="5" fill={INK} />
      <rect x="54" y="46" width="48" height="28" rx="10" fill={INK} />
      <rect x="30" y="66" width="116" height="88" rx="28" fill={BLUE} />
      <rect x="138" y="86" width="36" height="50" rx="14" fill={INK} />
      <circle cx="174" cy="111" r="11" fill={LENS} />
      <circle cx="177.5" cy="107" r="3.5" fill="#fff" />
      <ellipse cx="54" cy="128" rx="8" ry="5" fill={CHEEK} />
      <ellipse cx="120" cy="128" rx="8" ry="5" fill={CHEEK} />
    </>
  );
}

function Face({ mood }: { mood: Mood }) {
  if (mood === "rolling") {
    return (
      <>
        <circle className="dubu-rec-ring" cx="124" cy="84" r="7" fill="none" stroke="#fff" strokeWidth="2.5" />
        <circle cx="124" cy="84" r="5.5" fill="#fff" />
        <ellipse cx="68" cy="106" rx="11" ry="12.5" fill="#fff" />
        <circle cx="73.5" cy="106" r="5.5" fill={INK} />
        <ellipse cx="106" cy="106" rx="11" ry="12.5" fill="#fff" />
        <circle cx="111.5" cy="106" r="5.5" fill={INK} />
        <path d="M60 92 L76 95" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M98 95 L114 92" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="87" cy="132" rx="4.5" ry="5" fill={INK} />
      </>
    );
  }
  if (mood === "done") {
    return (
      <>
        <circle cx="124" cy="84" r="5.5" fill="#fff" />
        <path d="M58 110 Q68 97 78 110" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M96 110 Q106 97 116 110" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M73 126 Q87 146 101 126 Z" fill={INK} />
        <path className="dubu-star" d="M186 60 L189 70 L199 73 L189 76 L186 86 L183 76 L173 73 L183 70 Z" fill={BLUE} />
      </>
    );
  }
  if (mood === "oops") {
    return (
      <>
        <circle cx="124" cy="84" r="5" fill="none" stroke="#fff" strokeWidth="2.5" />
        <ellipse cx="68" cy="108" rx="10" ry="11" fill="#fff" />
        <circle cx="68" cy="113" r="5" fill={INK} />
        <ellipse cx="106" cy="108" rx="10" ry="11" fill="#fff" />
        <circle cx="106" cy="113" r="5" fill={INK} />
        <path d="M58 93 L76 89" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M98 89 L116 93" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <path d="M76 135 Q81 130 86 135 Q91 140 98 134" stroke="#fff" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    );
  }
  return (
    <>
      <circle cx="124" cy="84" r="5.5" fill="#fff" />
      <ellipse cx="68" cy="106" rx="11" ry="12.5" fill="#fff" />
      <circle cx="70" cy="108" r="5.5" fill={INK} />
      <ellipse cx="106" cy="106" rx="11" ry="12.5" fill="#fff" />
      <circle cx="108" cy="108" r="5.5" fill={INK} />
      <path d="M78 130 Q87 138 96 130" stroke="#fff" strokeWidth="4.5" fill="none" strokeLinecap="round" />
    </>
  );
}

/** Dubu, the handycam. Decorative by default; pass a label when it carries meaning. */
export function Mascot({
  mood = "idle",
  size = 160,
  decorative = true,
  className = "",
}: {
  mood?: Mood;
  size?: number;
  decorative?: boolean;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      className={className}
      {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": LABELS[mood] })}
    >
      <Body />
      <Face mood={mood} />
    </svg>
  );
}
