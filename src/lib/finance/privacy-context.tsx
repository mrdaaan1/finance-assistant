"use client";

import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "finance-assistant:hide-amounts";

type PrivacyContextValue = {
  hidden: boolean;
  toggle: () => void;
};

const PrivacyContext = createContext<PrivacyContextValue | null>(null);

function readInitialHidden(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "1";
}

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  // На сервере localStorage недоступен, поэтому SSR всегда рендерит false;
  // хук читает реальное значение сразу при маунте клиента, без setState
  // из useEffect (см. Next.js hydration guide в node_modules/next/dist/docs).
  const [hidden, setHidden] = useState(readInitialHidden);

  function toggle() {
    setHidden((prev) => {
      const next = !prev;
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return <PrivacyContext.Provider value={{ hidden, toggle }}>{children}</PrivacyContext.Provider>;
}

export function usePrivacy() {
  const ctx = useContext(PrivacyContext);
  if (!ctx) throw new Error("usePrivacy must be used within PrivacyProvider");
  return ctx;
}

/** Заглушка вместо суммы, когда режим приватности включён. */
export const MASKED_AMOUNT = "•••• ₽";
