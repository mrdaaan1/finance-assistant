"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { CatMascot } from "@/components/CatMascot";
import { useSession } from "@/lib/finance/session-context";
import { useAchievementsSync } from "@/lib/finance/use-achievements-sync";
import { ACHIEVEMENTS, ACHIEVEMENTS_BY_KEY, type AchievementCategory } from "@/lib/finance/achievements";

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  streak: "Серия дней",
  action: "Действия",
  milestone: "Рубежи",
};

const CATEGORY_ORDER: AchievementCategory[] = ["streak", "action", "milestone"];

function AchievementsContent() {
  const { supabase, profile, refreshProfile } = useSession();
  const syncAchievements = useAchievementsSync(supabase, profile);

  const [unlockedKeys, setUnlockedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    async function run() {
      const { unlockedKeys: unlocked, newlyGranted } = await syncAchievements();
      if (!active) return;
      setUnlockedKeys(unlocked);
      setLoading(false);
      if (newlyGranted.length > 0) {
        setCelebration(newlyGranted);
        await refreshProfile();
      }
    }
    run();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const streakAchievements = ACHIEVEMENTS.filter((a) => a.category === "streak");
  const currentStreak = profile?.current_streak ?? 0;
  const longestStreak = profile?.longest_streak ?? 0;

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-5 max-w-md mx-auto w-full">
      <div className="flex items-center gap-3">
        <Link
          href="/"
          aria-label="Назад на дашборд"
          className="w-10 h-10 rounded-full bg-card border border-card-border flex items-center justify-center text-lg text-muted"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold">🏆 Ачивки</h1>
          <p className="text-muted text-sm">Твои достижения и Бусты</p>
        </div>
      </div>

      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-white/80 text-xs uppercase tracking-wide">Баланс Бустов</p>
          <p className="text-3xl font-extrabold">{profile?.boosts_balance ?? 0} ⚡</p>
          <p className="text-white/70 text-xs mt-1">
            {unlockedKeys.size} из {ACHIEVEMENTS.length} ачивок открыто
          </p>
        </div>
        <CatMascot mood="happy" size={56} />
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-4">
        <p className="font-semibold mb-1">🔥 Серия дней подряд</p>
        <p className="text-2xl font-extrabold mb-3">{currentStreak} дней</p>
        <p className="text-muted text-xs mb-3">Рекорд: {longestStreak} дней</p>
        <div className="grid grid-cols-2 gap-2">
          {streakAchievements.map((a) => {
            const unlocked = unlockedKeys.has(a.key);
            return (
              <div
                key={a.key}
                className={`rounded-xl p-3 flex items-center gap-2 border ${
                  unlocked ? "bg-accent/10 border-accent/30" : "bg-background border-card-border opacity-50"
                }`}
              >
                <span className="text-xl">{a.icon}</span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">{a.title}</p>
                  <p className="text-[10px] text-muted">+{a.boosts} ⚡</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {loading && <p className="text-muted text-sm text-center">Считаю достижения…</p>}

      {CATEGORY_ORDER.filter((c) => c !== "streak").map((category) => (
        <div key={category} className="rounded-2xl bg-card border border-card-border p-4">
          <p className="font-semibold mb-3">{CATEGORY_LABELS[category]}</p>
          <div className="flex flex-col gap-2">
            {ACHIEVEMENTS.filter((a) => a.category === category).map((a) => {
              const unlocked = unlockedKeys.has(a.key);
              return (
                <div
                  key={a.key}
                  className={`rounded-xl p-3 flex items-center gap-3 border ${
                    unlocked ? "bg-accent/10 border-accent/30" : "bg-background border-card-border"
                  }`}
                >
                  <span className={`text-2xl ${unlocked ? "" : "grayscale opacity-40"}`}>{a.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{a.title}</p>
                    <p className="text-xs text-muted">{a.description}</p>
                  </div>
                  <span className={`text-xs font-bold whitespace-nowrap ${unlocked ? "text-accent" : "text-muted"}`}>
                    +{a.boosts} ⚡
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {celebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
          onClick={() => setCelebration(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-card border border-card-border p-6 flex flex-col items-center gap-3 text-center"
          >
            <CatMascot mood="happy" size={90} interactive />
            <p className="text-lg font-extrabold">Новая ачивка!</p>
            <div className="flex flex-col gap-2 w-full">
              {celebration.map((key) => {
                const def = ACHIEVEMENTS_BY_KEY.get(key);
                if (!def) return null;
                return (
                  <div key={key} className="rounded-xl bg-accent/10 border border-accent/30 p-3 flex items-center gap-3">
                    <span className="text-2xl">{def.icon}</span>
                    <div className="flex-1 text-left">
                      <p className="text-sm font-semibold">{def.title}</p>
                      <p className="text-xs text-muted">{def.description}</p>
                    </div>
                    <span className="text-xs font-bold text-accent">+{def.boosts} ⚡</span>
                  </div>
                );
              })}
            </div>
            <button
              onClick={() => setCelebration(null)}
              className="w-full rounded-xl bg-accent text-white py-3 font-semibold mt-1"
            >
              Мур-мур, спасибо!
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AchievementsPage() {
  return (
    <AuthGate>
      <AchievementsContent />
    </AuthGate>
  );
}
