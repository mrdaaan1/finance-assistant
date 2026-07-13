"use client";

import { useCallback } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ACHIEVEMENTS_BY_KEY, computeUnlockedKeys, type AchievementInputs } from "./achievements";
import type { Profile } from "./types";

const LOCAL_FLAGS_KEY = "finance-assistant:achievement-flags";

/** Разовые события без своей таблицы в БД — фиксируем локально на устройстве. */
export function markLocalAchievementFlag(flag: "talked_to_cat" | "exported_report") {
  if (typeof window === "undefined") return;
  const raw = window.localStorage.getItem(LOCAL_FLAGS_KEY);
  const flags = raw ? (JSON.parse(raw) as string[]) : [];
  if (!flags.includes(flag)) {
    flags.push(flag);
    window.localStorage.setItem(LOCAL_FLAGS_KEY, JSON.stringify(flags));
  }
}

function readLocalFlags(): Set<string> {
  if (typeof window === "undefined") return new Set();
  const raw = window.localStorage.getItem(LOCAL_FLAGS_KEY);
  return new Set(raw ? (JSON.parse(raw) as string[]) : []);
}

export type AchievementSyncResult = {
  unlockedKeys: Set<string>;
  newlyGranted: string[];
};

/**
 * Считает, какие ачивки выполнены у текущего пользователя, и досылает на
 * сервер начисление бустов за новые (grant_achievement сам защищает от
 * повторного начисления через unique-ограничение).
 */
export function useAchievementsSync(supabase: SupabaseClient, profile: Profile | null) {
  return useCallback(async (): Promise<AchievementSyncResult> => {
    if (!profile) return { unlockedKeys: new Set(), newlyGranted: [] };

    const [
      { count: transactionsCount },
      { data: kindsData },
      { count: goalsCount },
      { data: achievedGoal },
      { count: assetsCount },
      { count: recurringCount },
      { count: slotSpinsCount },
      { count: chessGamesCount },
      { count: chessWinsCount },
      { data: alreadyGranted },
    ] = await Promise.all([
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("kind").limit(500),
      supabase.from("goals").select("id", { count: "exact", head: true }),
      supabase.from("goals").select("id").eq("status", "achieved").limit(1),
      supabase.from("assets").select("id", { count: "exact", head: true }),
      supabase.from("recurring_expenses").select("id", { count: "exact", head: true }),
      supabase.from("slot_spins").select("id", { count: "exact", head: true }),
      supabase
        .from("chess_games")
        .select("id", { count: "exact", head: true })
        .or(`white_player_id.eq.${profile.id},black_player_id.eq.${profile.id}`),
      supabase.from("chess_games").select("id", { count: "exact", head: true }).eq("winner_id", profile.id),
      supabase.from("achievements").select("achievement_key"),
    ]);

    const kinds = new Set((kindsData ?? []).map((r) => (r as { kind: string }).kind));
    const localFlags = readLocalFlags();

    const inputs: AchievementInputs = {
      currentStreak: profile.current_streak,
      longestStreak: profile.longest_streak,
      transactionsCount: transactionsCount ?? 0,
      hasIncome: kinds.has("income"),
      hasSaving: kinds.has("saving"),
      goalsCount: goalsCount ?? 0,
      hasAchievedGoal: (achievedGoal?.length ?? 0) > 0,
      assetsCount: assetsCount ?? 0,
      recurringCount: recurringCount ?? 0,
      hasSlotSpin: (slotSpinsCount ?? 0) > 0,
      blockBlastBestScore: profile.block_blast_best_score,
      hasChessGame: (chessGamesCount ?? 0) > 0,
      hasChessWin: (chessWinsCount ?? 0) > 0,
      hasTalkedToCat: localFlags.has("talked_to_cat"),
      hasExportedReport: localFlags.has("exported_report"),
      isPremium: profile.is_premium,
    };

    const unlockedKeys = computeUnlockedKeys(inputs);
    const grantedKeys = new Set((alreadyGranted ?? []).map((r) => (r as { achievement_key: string }).achievement_key));

    const toGrant = [...unlockedKeys].filter((key) => !grantedKeys.has(key));
    const newlyGranted: string[] = [];

    for (const key of toGrant) {
      const def = ACHIEVEMENTS_BY_KEY.get(key);
      if (!def) continue;
      const { data: granted } = await supabase.rpc("grant_achievement", {
        p_achievement_key: key,
        p_boosts: def.boosts,
      });
      if (granted) newlyGranted.push(key);
    }

    return { unlockedKeys, newlyGranted };
  }, [supabase, profile]);
}
