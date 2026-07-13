"use client";

import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

function GamesHubContent() {
  const { profile } = useSession();

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-4 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">🎮 Игры</h1>

      <Link
        href="/games/slots"
        className="rounded-2xl bg-card border border-card-border p-5 flex items-center justify-between"
      >
        <div>
          <p className="font-semibold text-lg">🎰 Игровой автомат</p>
          <p className="text-muted text-sm">Крути слот на виртуальные деньги</p>
        </div>
        <p className="font-bold text-accent">{formatMoney(profile?.game_balance ?? 0)} ₽</p>
      </Link>

      <Link
        href="/games/chess"
        className="rounded-2xl bg-card border border-card-border p-5 flex items-center justify-between"
      >
        <div>
          <p className="font-semibold text-lg">♟️ Шахматы</p>
          <p className="text-muted text-sm">Играй онлайн с другим пользователем</p>
        </div>
        <span className="text-2xl">→</span>
      </Link>

      <Link
        href="/games/block-blast"
        className="rounded-2xl bg-card border border-card-border p-5 flex items-center justify-between"
      >
        <div>
          <p className="font-semibold text-lg">🧩 Блок-пазл</p>
          <p className="text-muted text-sm">Заполняй строки и столбцы, набирай рекорд</p>
        </div>
        <p className="font-bold text-accent">{profile?.block_blast_best_score ?? 0}</p>
      </Link>
    </main>
  );
}

export default function GamesHubPage() {
  return (
    <AuthGate>
      <GamesHubContent />
    </AuthGate>
  );
}
