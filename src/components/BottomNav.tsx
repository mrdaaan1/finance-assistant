"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Дашборд", icon: "🏠" },
  { href: "/transactions", label: "Траты", icon: "💸" },
  { href: "/goals", label: "Цели", icon: "🎯" },
  { href: "/assets", label: "Активы", icon: "🏦" },
  { href: "/games", label: "Игры", icon: "🎰" },
  { href: "/leaderboard", label: "Рейтинг", icon: "🔥" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-10 border-t border-card-border bg-card/95 backdrop-blur px-2"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 28px)" }}
    >
      <ul className="flex items-stretch justify-between">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
