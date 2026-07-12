"use client";

import { useState } from "react";

export type CatMood = "happy" | "sad" | "sleepy";

const moodProps: Record<CatMood, { earColor: string; eye: string; mouth: string }> = {
  happy: { earColor: "#8b7bf7", eye: "M -6 0 Q -6 -3 -3 -3 Q 0 -3 0 0", mouth: "M -8 6 Q 0 12 8 6" },
  sad: { earColor: "#6d6a99", eye: "M -6 -1 L 0 -1", mouth: "M -8 9 Q 0 4 8 9" },
  sleepy: { earColor: "#a596ff", eye: "M -6 0 L 0 0", mouth: "M -4 7 Q 0 9 4 7" },
};

const TAP_REACTIONS = ["cat-tap-wiggle", "cat-tap-bounce", "cat-tap-spin"];

export function CatMascot({
  mood = "happy",
  size = 96,
  className,
  animated = true,
  interactive = false,
}: {
  mood?: CatMood;
  size?: number;
  className?: string;
  animated?: boolean;
  interactive?: boolean;
}) {
  const { earColor, eye, mouth } = moodProps[mood];
  const [tapClass, setTapClass] = useState<string | null>(null);
  const [tapKey, setTapKey] = useState(0);

  function handleTap() {
    if (!interactive) return;
    const reaction = TAP_REACTIONS[Math.floor(Math.random() * TAP_REACTIONS.length)];
    setTapClass(reaction);
    setTapKey((k) => k + 1);
    window.setTimeout(() => setTapClass(null), 900);
  }

  return (
    <svg
      key={tapKey}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className ?? ""} ${tapClass ?? ""} ${interactive ? "cursor-pointer select-none" : ""}`}
      role={interactive ? "button" : "img"}
      aria-label={`Кот-помощник: ${mood}`}
      onClick={handleTap}
      style={{ transformOrigin: "50% 85%" }}
    >
      {animated && (
        <style>
          {`
            @keyframes cat-blink {
              0%, 88%, 100% { transform: scaleY(1); }
              92% { transform: scaleY(0.1); }
            }
            @keyframes cat-tongue {
              0%, 75%, 100% { opacity: 0; transform: translateY(0); }
              80%, 92% { opacity: 1; transform: translateY(3px); }
            }
            .cat-eye { transform-origin: center; animation: cat-blink 4s ease-in-out infinite; }
            .cat-tongue { animation: cat-tongue 6s ease-in-out infinite; }

            @keyframes cat-tap-wiggle {
              0% { transform: rotate(0deg) scale(1); }
              20% { transform: rotate(-12deg) scale(1.05); }
              40% { transform: rotate(10deg) scale(1.05); }
              60% { transform: rotate(-7deg) scale(1.02); }
              80% { transform: rotate(4deg) scale(1.01); }
              100% { transform: rotate(0deg) scale(1); }
            }
            @keyframes cat-tap-bounce {
              0% { transform: translateY(0) scale(1); }
              25% { transform: translateY(-14px) scale(1.08, 0.94); }
              45% { transform: translateY(0) scale(0.95, 1.08); }
              65% { transform: translateY(-6px) scale(1.03, 0.98); }
              100% { transform: translateY(0) scale(1); }
            }
            @keyframes cat-tap-spin {
              0% { transform: rotate(0deg) scale(1); }
              50% { transform: rotate(180deg) scale(1.1); }
              100% { transform: rotate(360deg) scale(1); }
            }
            .cat-tap-wiggle { animation: cat-tap-wiggle 0.7s ease-in-out; }
            .cat-tap-bounce { animation: cat-tap-bounce 0.8s cubic-bezier(0.34, 1.56, 0.64, 1); }
            .cat-tap-spin { animation: cat-tap-spin 0.9s ease-in-out; }
          `}
        </style>
      )}

      <path d="M28 30 L20 8 L42 24 Z" fill={earColor} />
      <path d="M72 30 L80 8 L58 24 Z" fill={earColor} />
      <ellipse cx="50" cy="55" rx="34" ry="30" fill="#2a2650" />
      <ellipse cx="50" cy="57" rx="27" ry="23" fill="#3a3570" />

      <g className={animated ? "cat-eye" : undefined} transform="translate(37, 52)">
        <path d={eye} stroke="#f3f2fb" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>
      <g className={animated ? "cat-eye" : undefined} transform="translate(63, 52)">
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

      {animated && mood !== "sad" && (
        <ellipse
          className="cat-tongue"
          cx="50"
          cy="70"
          rx="4"
          ry="5"
          fill="#e8749a"
        />
      )}

      <circle cx="30" cy="66" r="4" fill="#8b7bf7" opacity="0.5" />
      <circle cx="70" cy="66" r="4" fill="#8b7bf7" opacity="0.5" />
    </svg>
  );
}
