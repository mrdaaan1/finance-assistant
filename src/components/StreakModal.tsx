"use client";

import { useEffect, useState } from "react";
import { CatMascot } from "./CatMascot";

const ENCOURAGEMENTS = [
  "Отличное начало!",
  "Так держать!",
  "Ты на верном пути!",
  "Привычка формируется!",
  "Невероятная серия!",
];

export function StreakModal({
  streak,
  onClose,
}: {
  streak: number;
  onClose: () => void;
}) {
  const [bounce, setBounce] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setBounce((b) => !b), 600);
    return () => clearInterval(interval);
  }, []);

  const dayNumbers = Array.from({ length: Math.max(streak, 1) }, (_, i) => i + 1).slice(-5);
  const message = ENCOURAGEMENTS[Math.min(streak - 1, ENCOURAGEMENTS.length - 1)] ?? ENCOURAGEMENTS[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-card border border-card-border p-6 flex flex-col items-center gap-4 text-center"
      >
        <div
          className="transition-transform duration-500"
          style={{ transform: bounce ? "translateY(-6px) rotate(-4deg)" : "translateY(0) rotate(4deg)" }}
        >
          <CatMascot mood="happy" size={100} />
        </div>

        <div>
          <p className="text-2xl font-extrabold">{streak} {streak === 1 ? "день" : "дней"} подряд!</p>
          <p className="text-muted text-sm mt-1">{message}</p>
        </div>

        <div className="flex gap-2">
          {dayNumbers.map((day) => (
            <div
              key={day}
              className={`flex flex-col items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                day === streak
                  ? "bg-accent text-white scale-110"
                  : "bg-background text-muted"
              }`}
            >
              🔥{day}
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-accent text-white py-3 font-semibold"
        >
          Продолжить
        </button>
      </div>
    </div>
  );
}
