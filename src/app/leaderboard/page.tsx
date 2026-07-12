"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CatMascot } from "@/components/CatMascot";
import { useSession } from "@/lib/finance/session-context";
import { avatarEmoji, type Profile } from "@/lib/finance/types";

function LeaderboardPageContent() {
  const { supabase, profile } = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id, telegram_id, username, first_name, last_name, avatar_url, display_name, avatar_key, onboarded, is_premium, current_streak, longest_streak, last_active_date, created_at",
        )
        .eq("onboarded", true)
        .order("current_streak", { ascending: false })
        .order("longest_streak", { ascending: false });

      if (data) setProfiles(data as Profile[]);
    }
    load();
  }, [supabase]);

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-5 max-w-md mx-auto w-full">
      <div className="flex items-center gap-3">
        <CatMascot mood="happy" size={56} />
        <div>
          <h1 className="text-xl font-bold">Рейтинг серий</h1>
          <p className="text-muted text-sm">Кто дольше всех ведёт учёт подряд</p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {profiles.map((p, index) => {
          const isMe = p.id === profile?.id;
          return (
            <li
              key={p.id}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${
                isMe ? "bg-accent/10 border-accent" : "bg-card border-card-border"
              }`}
            >
              <span className="text-sm font-semibold text-muted w-6">{index + 1}</span>
              <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center text-xl">
                {avatarEmoji(p.avatar_key)}
              </div>
              <div className="flex flex-col flex-1">
                <span className="font-medium flex items-center gap-1">
                  {p.display_name ?? "Аноним"}
                  {p.is_premium && <span title="Premium">⭐</span>}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="font-bold">{p.current_streak} 🔥</span>
                <span className="text-xs text-muted">рекорд {p.longest_streak}</span>
              </div>
            </li>
          );
        })}
        {profiles.length === 0 && (
          <p className="text-muted text-center py-8">Пока никого нет</p>
        )}
      </ul>
    </main>
  );
}

export default function LeaderboardPage() {
  return (
    <AuthGate>
      <LeaderboardPageContent />
    </AuthGate>
  );
}
