"use client";

import { useState } from "react";
import { useSession } from "@/lib/finance/session-context";
import { AVATAR_OPTIONS, type AvatarKey } from "@/lib/finance/types";
import { CatMascot } from "./CatMascot";

export function OnboardingScreen() {
  const { supabase, profile, refreshProfile } = useSession();
  const [displayName, setDisplayName] = useState("");
  const [avatarKey, setAvatarKey] = useState<AvatarKey>("cat");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !displayName.trim()) return;

    setSubmitting(true);
    setError(null);

    const { data: updated, error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim(), avatar_key: avatarKey, onboarded: true })
      .eq("id", profile.id)
      .select("id");

    if (updateError || !updated || updated.length === 0) {
      setError("Не удалось сохранить. Попробуй ещё раз.");
      setSubmitting(false);
      return;
    }

    await refreshProfile();
    setSubmitting(false);
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-8 gap-6 max-w-md mx-auto w-full">
      <div className="flex flex-col items-center gap-3 text-center">
        <CatMascot mood="happy" size={88} />
        <h1 className="text-xl font-bold">Добро пожаловать!</h1>
        <p className="text-muted text-sm">
          Придумай ник и выбери аватарку — они будут видны другим в рейтинге
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Твой ник"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={24}
          required
          className="rounded-xl border border-card-border bg-card px-4 py-3 text-base outline-none focus:border-accent"
        />

        <div className="grid grid-cols-5 gap-2">
          {AVATAR_OPTIONS.map((avatar) => (
            <button
              key={avatar.key}
              type="button"
              onClick={() => setAvatarKey(avatar.key)}
              className={`aspect-square rounded-xl border text-2xl flex items-center justify-center transition-colors ${
                avatarKey === avatar.key
                  ? "bg-accent/20 border-accent"
                  : "bg-card border-card-border"
              }`}
            >
              {avatar.emoji}
            </button>
          ))}
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

        <button
          type="submit"
          disabled={submitting || !displayName.trim()}
          className="rounded-xl bg-accent text-white py-3 font-semibold disabled:opacity-50"
        >
          {submitting ? "Сохраняю…" : "Начать"}
        </button>
      </form>
    </main>
  );
}
