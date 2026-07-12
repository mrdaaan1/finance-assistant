"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/finance/types";

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

type Status = "loading" | "error" | "ready";

export default function Home() {
  const [status, setStatus] = useState<Status>("loading");
  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    const supabase = createClient();

    async function authenticateAndLoad() {
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

      const { data, error: selectError } = await supabase
        .from("profiles")
        .select("id, telegram_id, username, first_name, last_name, avatar_url, created_at")
        .order("created_at", { ascending: true });

      if (selectError) {
        setStatus("error");
        return;
      }

      setProfiles(data ?? []);
      setStatus("ready");
    }

    authenticateAndLoad();
  }, []);

  return (
    <main className="flex-1 flex flex-col items-center px-4 py-8 text-blue-950">
      <h1 className="text-2xl font-bold text-blue-700 mb-6">
        Финансовый помощник
      </h1>

      {status === "loading" && <p className="text-blue-500">Загрузка…</p>}

      {status === "error" && (
        <p className="text-blue-500 text-center max-w-sm">
          Не удалось авторизоваться. Открой это приложение через кнопку в
          Telegram-боте.
        </p>
      )}

      {status === "ready" && (
        <div className="w-full max-w-md">
          <h2 className="text-lg font-semibold text-blue-800 mb-3">
            Участники ({profiles.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {profiles.map((profile, index) => (
              <li
                key={profile.id}
                className="flex items-center gap-3 rounded-xl bg-white/70 px-4 py-3 shadow-sm border border-blue-100"
              >
                <span className="text-sm font-medium text-blue-400 w-6">
                  {index + 1}
                </span>
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-blue-200 flex items-center justify-center text-blue-700 font-semibold">
                    {profile.first_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex flex-col">
                  <span className="font-medium">
                    {profile.first_name} {profile.last_name ?? ""}
                  </span>
                  {profile.username && (
                    <span className="text-sm text-blue-400">
                      @{profile.username}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
