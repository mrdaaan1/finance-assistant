export type CatMood = "happy" | "sad" | "sleepy";

const moodProps: Record<CatMood, { earColor: string; eye: string; mouth: string }> = {
  happy: { earColor: "#8b7bf7", eye: "M -6 0 Q -6 -3 -3 -3 Q 0 -3 0 0", mouth: "M -8 6 Q 0 12 8 6" },
  sad: { earColor: "#6d6a99", eye: "M -6 -1 L 0 -1", mouth: "M -8 9 Q 0 4 8 9" },
  sleepy: { earColor: "#a596ff", eye: "M -6 0 L 0 0", mouth: "M -4 7 Q 0 9 4 7" },
};

export function CatMascot({
  mood = "happy",
  size = 96,
  className,
}: {
  mood?: CatMood;
  size?: number;
  className?: string;
}) {
  const { earColor, eye, mouth } = moodProps[mood];

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label={`Кот-помощник: ${mood}`}
    >
      <path d="M28 30 L20 8 L42 24 Z" fill={earColor} />
      <path d="M72 30 L80 8 L58 24 Z" fill={earColor} />
      <ellipse cx="50" cy="55" rx="34" ry="30" fill="#2a2650" />
      <ellipse cx="50" cy="57" rx="27" ry="23" fill="#3a3570" />

      <g transform="translate(37, 52)">
        <path d={eye} stroke="#f3f2fb" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <g transform="translate(63, 52)">
        <path d={eye} stroke="#f3f2fb" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>

      <path
        d={mouth}
        transform="translate(50, 60)"
        stroke="#f3f2fb"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />

      <circle cx="30" cy="66" r="4" fill="#8b7bf7" opacity="0.5" />
      <circle cx="70" cy="66" r="4" fill="#8b7bf7" opacity="0.5" />
    </svg>
  );
}
