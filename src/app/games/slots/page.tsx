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

    // Промежуточные кадры анимации подбираются так, чтобы все три символа
    // никогда случайно не совпали — иначе игрок видит на экране "джекпот",
    // которого сервер не подтверждал, и решает, что приложение его обсчитало
    // (так и произошло с Романом Ивановым: 3 вишни мелькнули во время
    // вращения, а настоящий, более поздний ответ сервера был проигрышным).
    const shuffleInterval = window.setInterval(() => {
      const first = randomSymbol();
      const second = randomSymbol();
      let third = randomSymbol();
      while (first === second && second === third) {
        third = randomSymbol();
      }
      setReels([first, second, third]);
    }, 80);

    try {
      const res = await fetch("/api/slot-spin", { method: "POST" });

      // res.json() бросает исключение, если сервер вернул не-JSON (например,
      // HTML-страницу таймаута при обрыве по Vercel maxDuration) — тогда мы
      // не знаем, прошла ли ставка на сервере на самом деле, поэтому дальше
      // не оставляем на экране случайный кадр анимации, а перечитываем
      // реальный баланс из БД.
      let data: { reels?: string[]; isWin?: boolean; payout?: number; error?: string };
      try {
        data = await res.json();
      } catch {
        window.clearInterval(shuffleInterval);
        setReels(["❓", "❓", "❓"]);
        setError("Связь с сервером прервалась. Проверь баланс — если списание прошло, деньги уже на месте.");
        await refreshProfile();
        return;
      }

      if (!res.ok) {
        window.clearInterval(shuffleInterval);
        setReels(["❓", "❓", "❓"]);
        setError(data.error === "insufficient_balance" ? "Недостаточно игровых денег" : "Что-то пошло не так, попробуй ещё раз");
        await refreshProfile();
        return;
      }

      // Таймер обязательно глушим ДО того, как выставляем финальные reels и
      // result: иначе между этим setReels и вызовом clearInterval в finally
      // может проскочить ещё один тик shuffle-интервала (React батчит
      // обновление состояния асинхронно, а setInterval — независимый таймер)
      // и перезаписать честный результат случайной картинкой — барабаны
      // замирают не на том, что реально выпало, при этом текст "Джекпот"
      // уже показывает правильные данные. Ровно так и получилось: в БД
      // всё честно (3 колокольчика), а на экране застыл случайный набор.
      window.clearInterval(shuffleInterval);
      setReels(data.reels!);
      setResult({ isWin: data.isWin!, payout: data.payout! });
      await refreshProfile();
    } catch {
      window.clearInterval(shuffleInterval);
      setReels(["❓", "❓", "❓"]);
      setError("Не удалось связаться с сервером. Проверь баланс — если списание прошло, деньги уже на месте.");
      await refreshProfile();
    } finally {
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
