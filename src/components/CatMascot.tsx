"use client";

import { useState } from "react";

export type CatMood = "happy" | "sad" | "sleepy";

// Живые состояния для голосового чата: приоритетнее mood.
export type CatState = "idle" | "listening" | "thinking" | "talking";

const moodProps: Record<CatMood, { earColor: string; eye: string; mouth: string }> = {
  happy: { earColor: "#8b7bf7", eye: "M -6 0 Q -6 -3 -3 -3 Q 0 -3 0 0", mouth: "M -8 6 Q 0 12 8 6" },
  sad: { earColor: "#6d6a99", eye: "M -6 -1 L 0 -1", mouth: "M -8 9 Q 0 4 8 9" },
  sleepy: { earColor: "#a596ff", eye: "M -6 0 L 0 0", mouth: "M -4 7 Q 0 9 4 7" },
};

const TAP_REACTIONS = ["cat-tap-wiggle", "cat-tap-bounce", "cat-tap-spin"];

export function CatMascot({
  mood = "happy",
  state = "idle",
  size = 96,
  className,
  animated = true,
  interactive = false,
}: {
  mood?: CatMood;
  state?: CatState;
  size?: number;
  className?: string;
  animated?: boolean;
  interactive?: boolean;
}) {
  const { earColor, eye, mouth } = moodProps[mood];
  const [tapClass, setTapClass] = useState<string | null>(null);
  const [tapKey, setTapKey] = useState(0);

  const listening = state === "listening";
  const thinking = state === "thinking";
  const talking = state === "talking";

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
      aria-label={`Кот-помощник: ${state !== "idle" ? state : mood}`}
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
            @keyframes cat-breathe {
              0%, 100% { transform: scale(1); }
              50% { transform: scale(1.015); }
            }
            @keyframes cat-tail-swish {
              0%, 100% { transform: rotate(0deg); }
              40% { transform: rotate(9deg); }
              70% { transform: rotate(-4deg); }
            }
            @keyframes cat-ear-perk {
              0%, 100% { transform: rotate(0deg); }
              30% { transform: rotate(-7deg); }
              60% { transform: rotate(5deg); }
            }
            @keyframes cat-talk-mouth {
              0%, 100% { transform: scaleY(0.35); }
              50% { transform: scaleY(1); }
            }
            @keyframes cat-head-bob {
              0%, 100% { transform: translateY(0); }
              50% { transform: translateY(-1.6px); }
            }
            @keyframes cat-pulse-ring {
              0% { transform: scale(0.72); opacity: 0.55; }
              100% { transform: scale(1.22); opacity: 0; }
            }
            @keyframes cat-think-dot {
              0%, 100% { opacity: 0.25; transform: translateY(0); }
              50% { opacity: 1; transform: translateY(-2px); }
            }
            .cat-eye { transform-origin: center; animation: cat-blink 4s ease-in-out infinite; }
            .cat-tongue { animation: cat-tongue 6s ease-in-out infinite; }
            .cat-body { transform-box: fill-box; transform-origin: 50% 80%; animation: cat-breathe 3.4s ease-in-out infinite; }
            .cat-tail { transform-box: fill-box; transform-origin: 15% 85%; animation: cat-tail-swish 5s ease-in-out infinite; }
            .cat-ear { transform-box: fill-box; transform-origin: 50% 100%; }
            .cat-ear-perk { animation: cat-ear-perk 1.1s ease-in-out infinite; }
            .cat-talk-mouth { transform-box: fill-box; transform-origin: center; animation: cat-talk-mouth 0.28s ease-in-out infinite; }
            .cat-head-bob { animation: cat-head-bob 0.56s ease-in-out infinite; }
            .cat-pulse-ring { transform-box: fill-box; transform-origin: center; animation: cat-pulse-ring 1.4s ease-out infinite; }
            .cat-pulse-ring-2 { animation-delay: 0.7s; }
            .cat-think-dot { animation: cat-think-dot 1.2s ease-in-out infinite; }

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

      {listening && animated && (
        <>
          <circle className="cat-pulse-ring" cx="50" cy="55" r="42" stroke="#8b7bf7" strokeWidth="2" fill="none" />
          <circle className="cat-pulse-ring cat-pulse-ring-2" cx="50" cy="55" r="42" stroke="#8b7bf7" strokeWidth="2" fill="none" />
        </>
      )}

      <g className={animated ? "cat-body" : undefined}>
        {/* Хвост позади туловища */}
        <path
          className={animated ? "cat-tail" : undefined}
          d="M76 72 Q 94 68 92 50 Q 91 42 85 40"
          stroke="#2a2650"
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />

        <g className={talking && animated ? "cat-head-bob" : undefined}>
          <g className={`cat-ear ${listening && animated ? "cat-ear-perk" : ""}`}>
            <path d="M28 30 L20 8 L42 24 Z" fill={earColor} />
            <path d="M29 26 L25 14 L37 23 Z" fill="#e8749a" opacity="0.55" />
          </g>
          <g className={`cat-ear ${listening && animated ? "cat-ear-perk" : ""}`}>
            <path d="M72 30 L80 8 L58 24 Z" fill={earColor} />
            <path d="M71 26 L75 14 L63 23 Z" fill="#e8749a" opacity="0.55" />
          </g>

          <ellipse cx="50" cy="55" rx="34" ry="30" fill="#2a2650" />
          <ellipse cx="50" cy="57" rx="27" ry="23" fill="#3a3570" />

          {/* Усы */}
          <g stroke="#c9c4ee" strokeWidth="1.4" strokeLinecap="round" opacity="0.8">
            <path d="M24 60 Q 14 58 7 54" fill="none" />
            <path d="M24 65 Q 13 65 6 64" fill="none" />
            <path d="M76 60 Q 86 58 93 54" fill="none" />
            <path d="M76 65 Q 87 65 94 64" fill="none" />
          </g>

          <g className={animated ? "cat-eye" : undefined} transform="translate(37, 52)">
            <path d={eye} stroke="#f3f2fb" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
          <g className={animated ? "cat-eye" : undefined} transform="translate(63, 52)">
            <path d={eye} stroke="#f3f2fb" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>

          {/* Носик */}
          <path d="M47 59 L53 59 L50 62.5 Z" fill="#e8749a" />

          {talking && animated ? (
            <ellipse className="cat-talk-mouth" cx="50" cy="69" rx="6" ry="5" fill="#1c1938" />
          ) : (
            <path
              d={mouth}
              transform="translate(50, 60)"
              stroke="#f3f2fb"
              strokeWidth="2.5"
              strokeLinecap="round"
              fill="none"
            />
          )}

          {animated && !talking && mood !== "sad" && (
            <ellipse className="cat-tongue" cx="50" cy="70" rx="4" ry="5" fill="#e8749a" />
          )}

          <circle cx="30" cy="66" r="4" fill="#8b7bf7" opacity="0.5" />
          <circle cx="70" cy="66" r="4" fill="#8b7bf7" opacity="0.5" />
        </g>
      </g>

      {thinking && animated && (
        <g fill="#8b7bf7">
          <circle className="cat-think-dot" cx="78" cy="24" r="3" />
          <circle className="cat-think-dot" cx="87" cy="18" r="4" style={{ animationDelay: "0.2s" }} />
          <circle className="cat-think-dot" cx="95" cy="10" r="5" style={{ animationDelay: "0.4s" }} />
        </g>
      )}
    </svg>
  );
}
