"use client";

import { useState } from "react";

/** Маленькая обучающая подсказка (ⓘ) — раскрывается по тапу, коротко объясняет термин на месте, где пользователь принимает решение. */
export function InfoTip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Пояснение"
        className="w-4 h-4 rounded-full bg-accent/20 text-accent text-[10px] font-bold inline-flex items-center justify-center align-middle ml-1"
      >
        i
      </button>
      {open && (
        <span
          onClick={() => setOpen(false)}
          className="absolute z-20 left-1/2 -translate-x-1/2 top-6 w-56 rounded-xl bg-foreground text-background text-xs p-3 shadow-lg leading-snug"
        >
          {children}
        </span>
      )}
    </span>
  );
}
