"use client";

import { useSession } from "@/lib/finance/session-context";
import { CatMascot } from "./CatMascot";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        <CatMascot mood="sleepy" />
        <p className="text-muted">Загрузка…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <CatMascot mood="sad" />
        <p className="text-muted max-w-sm">
          Не удалось авторизоваться. Открой это приложение через кнопку в
          Telegram-боте.
        </p>
      </main>
    );
  }

  return <>{children}</>;
}
