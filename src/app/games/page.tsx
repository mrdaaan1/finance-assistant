"use client";

import { useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";

const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "7️⃣"];
const BET_AMOUNT = 1000;

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function GamesPageContent() {
  const { profile, refreshProfile } = useSession();
  const [reels, setReels] = useState<string[]>(["7️⃣", "7️⃣", "7️⃣"]);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ isWin: boolean; payout: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const balance = profile?.game_balance ?? 0;

  async function handleSpin() {
    if (spinning || balance < BET_AMOUNT) return;

    setSpinning(true);
    setResult(null);
    setError(null);

    // Быстро "перетасовываем" символы для эффекта вращения, пока ждём ответ сервера
    const shuffleInterval = window.setInterval(() => {
      setReels([randomSymbol(), randomSymbol(), randomSymbol()]);
    }, 80);

    try {
      const res = await fetch("/api/slot-spin", { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error === "insufficient_balance" ? "Недостаточно игровых денег" : "Что-то пошло не так");
        return;
      }

      setReels(data.reels);
      setResult({ isWin: data.isWin, payout: data.payout });
      await refreshProfile();
    } catch {
      setError("Не удалось связаться с сервером. Попробуй ещё раз.");
    } finally {
      window.clearInterval(shuffleInterval);
      setSpinning(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">🎰 Игровой автомат</h1>

      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-5 shadow-sm">
        <p className="text-white/80 text-xs uppercase tracking-wide">Игровой баланс</p>
        <p className="text-3xl font-extrabold">{formatMoney(balance)} ₽</p>
        <p className="text-white/70 text-xs mt-1">Виртуальные деньги, не влияют на реальный бюджет</p>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-6 flex flex-col items-center gap-5">
        <div className="flex gap-3">
          {reels.map((symbol, i) => (
            <div
              key={i}
              className={`w-20 h-20 rounded-2xl bg-background border border-card-border flex items-center justify-center text-4xl ${
                spinning ? "animate-bounce" : ""
              }`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              {symbol}
            </div>
          ))}
        </div>

        <button
          onClick={handleSpin}
          disabled={spinning || balance < BET_AMOUNT}
          className="w-full rounded-xl bg-accent text-white py-3 font-semibold disabled:opacity-50"
        >
          {spinning ? "Крутится…" : `Крутить за ${formatMoney(BET_AMOUNT)} ₽`}
        </button>

        {result && (
          <p className={`text-center font-bold ${result.isWin ? "text-emerald-500" : "text-muted"}`}>
            {result.isWin
              ? `🎉 Джекпот! Выигрыш ${formatMoney(result.payout)} ₽`
              : "Не повезло — попробуй ещё раз"}
          </p>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </div>

      <p className="text-muted text-xs text-center">
        Каждый день баланс пополняется на 10 000 ₽ за первую внесённую операцию
      </p>
    </main>
  );
}

export default function GamesPage() {
  return (
    <AuthGate>
      <GamesPageContent />
    </AuthGate>
  );
}
