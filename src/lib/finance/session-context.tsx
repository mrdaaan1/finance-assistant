"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "./types";

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  openInvoice: (url: string, callback: (status: string) => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type SessionStatus = "loading" | "error" | "ready";

type SessionContextValue = {
  status: SessionStatus;
  profile: Profile | null;
  supabase: SupabaseClient;
  refreshProfile: () => Promise<void>;
  waitForPremium: () => Promise<boolean>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const PROFILE_COLUMNS =
  "id, telegram_id, username, first_name, last_name, avatar_url, display_name, avatar_key, onboarded, is_premium, game_balance, boosts_balance, block_blast_best_score, current_streak, longest_streak, last_active_date, created_at";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);

  async function refreshProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("auth_user_id", user.id)
      .maybeSingle();

    if (data) setProfile(data as Profile);
  }

  async function waitForPremium(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    for (let attempt = 0; attempt < 6; attempt++) {
      const { data } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (data) {
        setProfile(data as Profile);
        if ((data as Profile).is_premium) return true;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    return false;
  }

  useEffect(() => {
    async function authenticate() {
      const webApp = window.Telegram?.WebApp;
      if (!webApp?.initData) {
        setStatus("error");
        return;
      }

      webApp.ready();
      webApp.expand();

      const res = await fetch("/api/telegram-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: webApp.initData }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const { access_token, refresh_token } = await res.json();
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        setStatus("error");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setStatus("error");
        return;
      }

      const { data: profileData, error: selectError } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("auth_user_id", userData.user.id)
        .maybeSingle();

      if (selectError || !profileData) {
        setStatus("error");
        return;
      }

      setProfile(profileData as Profile);
      setStatus("ready");
    }

    authenticate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SessionContext.Provider value={{ status, profile, supabase, refreshProfile, waitForPremium }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}
