"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";
import {
  MAX_ATTEMPTS,
  WORD_LENGTH,
  evaluateGuess,
  isValidGuess,
  isWin,
  wordForDate,
  type LetterStatus,
} from "@/lib/games/five-letters";

const RU_KEYBOARD_ROWS = [
  ["й", "ц", "у", "к", "е", "н", "г", "ш", "щ", "з", "х", "ъ"],
  ["ф", "ы", "в", "а", "п", "р", "о", "л", "д", "ж", "э"],
  ["я", "ч", "с", "м", "и", "т", "ь", "б", "ю"],
];

function todayKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

const STATUS_STYLES: Record<LetterStatus, string> = {
  correct: "bg-accent border-accent text-white",
  present: "bg-yellow-400 border-yellow-400 text-white",
  absent: "bg-muted/30 border-card-border text-muted",
};

type StoredState = {
  key: string;
  guesses: string[];
  statuses: LetterStatus[][];
  finished: boolean;
  won: boolean;
};

const STORAGE_KEY = "five-letters-state";

function loadState(): StoredState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredState;
    if (parsed.key !== todayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveState(state: StoredState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function FiveLettersContent() {
  const { profile, refreshProfile } = useSession();
  const answer = useMemo(() => wordForDate(), []);

  const initialState = useMemo(() => loadState(), []);
  const [guesses, setGuesses] = useState<string[]>(() => initialState?.guesses ?? []);
  const [statuses, setStatuses] = useState<LetterStatus[][]>(() => initialState?.statuses ?? []);
  const [current, setCurrent] = useState("");
  const [finished, setFinished] = useState(() => initialState?.finished ?? false);
  const [won, setWon] = useState(() => initialState?.won ?? false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const bestStreak = profile?.five_letters_best_streak ?? 0;
  const currentStreak = profile?.five_letters_current_streak ?? 0;
  const alreadyPlayedToday = profile?.five_letters_last_play_date === new Date().toISOString().slice(0, 10);

  const submitResult = useCallback(
    async (didWin: boolean, attempts: number) => {
      setSubmitting(true);
      try {
        const res = await fetch("/api/five-letters-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ won: didWin, attempts }),
        });
        if (res.ok) await refreshProfile();
      } finally {
        setSubmitting(false);
      }
    },
    [refreshProfile]
  );

  const handleSubmitGuess = useCallback(() => {
    if (finished || alreadyPlayedToday) return;
    setError(null);

    if (current.length !== WORD_LENGTH) {
      setError(`Слово должно быть из ${WORD_LENGTH} букв`);
      return;
    }
    if (!isValidGuess(current)) {
      setError("Такого слова нет в словаре");
      return;
    }

    const status = evaluateGuess(current, answer);
    const nextGuesses = [...guesses, current];
    const nextStatuses = [...statuses, status];
    const didWin = isWin(status);
    const isLast = nextGuesses.length >= MAX_ATTEMPTS;
    const isFinished = didWin || isLast;

    setGuesses(nextGuesses);
    setStatuses(nextStatuses);
    setCurrent("");
    setFinished(isFinished);
    setWon(didWin);

    saveState({
      key: todayKey(),
      guesses: nextGuesses,
      statuses: nextStatuses,
      finished: isFinished,
      won: didWin,
    });

    if (isFinished) {
      submitResult(didWin, nextGuesses.length);
    }
  }, [current, guesses, statuses, answer, finished, alreadyPlayedToday, submitResult]);

  const handleKey = useCallback(
    (key: string) => {
      if (finished || alreadyPlayedToday) return;
      setError(null);
      if (key === "backspace") {
        setCurrent((c) => c.slice(0, -1));
        return;
      }
      if (key === "enter") {
        handleSubmitGuess();
        return;
      }
      setCurrent((c) => (c.length < WORD_LENGTH ? c + key : c));
    },
    [finished, alreadyPlayedToday, handleSubmitGuess]
  );

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === "enter") return handleKey("enter");
      if (k === "backspace") return handleKey("backspace");
      if (/^[а-яё]$/.test(k)) return handleKey(k);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKey]);

  const rows = Array.from({ length: MAX_ATTEMPTS }, (_, i) => {
    if (i < guesses.length) return { letters: guesses[i].split(""), status: statuses[i] };
    if (i === guesses.length && !finished && !alreadyPlayedToday) {
      return { letters: current.padEnd(WORD_LENGTH, " ").split(""), status: null };
    }
    return { letters: Array(WORD_LENGTH).fill(""), status: null };
  });

  const showDone = finished || alreadyPlayedToday;

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-4 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between">
        <Link href="/games" className="text-muted text-sm">
          ← Игры
        </Link>
        <h1 className="text-xl font-bold">🔤 5 букв</h1>
        <div className="w-10" />
      </div>

      <div className="flex justify-center gap-4 text-sm text-muted">
        <span>
          Серия: <span className="font-bold text-accent">{currentStreak}</span>
        </span>
        <span>
          Рекорд: <span className="font-bold text-accent">{bestStreak}</span>
        </span>
      </div>

      <div className="flex flex-col gap-1.5 items-center">
        {rows.map((row, ri) => (
          <div key={ri} className="flex gap-1.5">
            {row.letters.map((letter, ci) => (
              <div
                key={ci}
                className={`w-11 h-11 flex items-center justify-center rounded-lg border-2 text-lg font-bold uppercase ${
                  row.status ? STATUS_STYLES[row.status[ci]] : "border-card-border bg-card"
                }`}
              >
                {letter.trim()}
              </div>
            ))}
          </div>
        ))}
      </div>

      {error && <p className="text-center text-sm text-red-500">{error}</p>}

      {alreadyPlayedToday && !guesses.length && (
        <p className="text-center text-sm text-muted">
          Сегодня уже сыграно. Загляни завтра за новым словом!
        </p>
      )}

      {finished && (
        <p className="text-center font-semibold">
          {won ? "🎉 Угадано!" : `😔 Слово было: ${answer.toUpperCase()}`}
          {submitting && " · сохраняем…"}
        </p>
      )}

      {!showDone && (
        <div className="flex flex-col gap-1.5 mt-auto">
          {RU_KEYBOARD_ROWS.map((row, ri) => (
            <div key={ri} className="flex justify-center gap-1">
              {row.map((letter) => (
                <button
                  key={letter}
                  onClick={() => handleKey(letter)}
                  className="min-w-8 h-11 px-1 rounded-md bg-card border border-card-border text-sm font-semibold uppercase"
                >
                  {letter}
                </button>
              ))}
            </div>
          ))}
          <div className="flex justify-center gap-1">
            <button
              onClick={() => handleKey("backspace")}
              className="h-11 px-4 rounded-md bg-card border border-card-border text-sm font-semibold"
            >
              ⌫
            </button>
            <button
              onClick={() => handleKey("enter")}
              className="h-11 px-4 rounded-md bg-accent text-white text-sm font-semibold"
            >
              Ввод
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function FiveLettersPage() {
  return (
    <AuthGate>
      <FiveLettersContent />
    </AuthGate>
  );
}
