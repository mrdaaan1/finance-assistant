"use client";

import { useEffect, useMemo, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { CatMascot, type CatMood } from "@/components/CatMascot";
import { useSession } from "@/lib/finance/session-context";
import type { RecurringExpense, Transaction } from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // понедельник = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function catMoodForStreak(streak: number): CatMood {
  if (streak <= 0) return "sad";
  if (streak >= 3) return "happy";
  return "sleepy";
}

function DashboardContent() {
  const { supabase, profile, refreshProfile, waitForPremium } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [plannedIncome, setPlannedIncome] = useState(0);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string | null>(null);
  const [buyingPremium, setBuyingPremium] = useState(false);

  async function handleExport() {
    setExporting(true);
    setExportMessage(null);
    const res = await fetch("/api/export", { method: "POST" });
    setExporting(false);
    setExportMessage(res.ok ? "Отчёт отправлен тебе в чат с ботом 📩" : "Не удалось отправить отчёт");
  }

  async function handleBuyPremium() {
    setBuyingPremium(true);
    const res = await fetch("/api/create-invoice", { method: "POST" });
    const data = await res.json();

    if (!res.ok || !data.invoiceLink) {
      setBuyingPremium(false);
      return;
    }

    window.Telegram?.WebApp?.openInvoice(data.invoiceLink, async (status) => {
      if (status === "paid") {
        // Вебхук от Telegram обрабатывается на сервере асинхронно и может
        // занять секунду-другую — подождём, пока is_premium реально станет true.
        await waitForPremium();
      }
      setBuyingPremium(false);
    });
  }

  useEffect(() => {
    async function load() {
      const monthAgo = startOfMonth(new Date()).toISOString().slice(0, 10);
      const [{ data: txs }, { data: events }, { data: recurring }] = await Promise.all([
        supabase
          .from("transactions")
          .select(
            "id, user_id, category_id, goal_id, kind, amount, occurred_on, comment, created_at, category:categories(id, user_id, name, kind, icon, is_system)",
          )
          .gte("occurred_on", monthAgo)
          .order("occurred_on", { ascending: false }),
        supabase
          .from("financial_plan_events")
          .select("event_type, payload, effective_from")
          .eq("event_type", "income_change")
          .order("effective_from", { ascending: true }),
        supabase.from("recurring_expenses").select("*").eq("is_active", true),
      ]);

      if (txs) setTransactions(txs as unknown as Transaction[]);
      if (events && events.length > 0) {
        const latest = events[events.length - 1] as { payload: { new_monthly_income: number } };
        setPlannedIncome(latest.payload.new_monthly_income);
      }
      if (recurring) setRecurringExpenses(recurring as RecurringExpense[]);
    }
    load();
  }, [supabase]);

  const stats = useMemo(() => {
    const now = new Date();
    const weekStart = startOfWeek(now);
    const monthStart = startOfMonth(now);

    let weekExpenses = 0;
    let monthExpenses = 0;
    let extraMonthIncome = 0;
    const byCategory = new Map<string, number>();

    for (const tx of transactions) {
      const occurred = new Date(tx.occurred_on);
      if (tx.kind === "expense") {
        if (occurred >= monthStart) monthExpenses += tx.amount;
        if (occurred >= weekStart) weekExpenses += tx.amount;

        const name = tx.category?.name ?? "Без категории";
        byCategory.set(name, (byCategory.get(name) ?? 0) + tx.amount);
      } else if (tx.kind === "income") {
        if (occurred >= monthStart) extraMonthIncome += tx.amount;
      }
    }

    const topCategories = [...byCategory.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { weekExpenses, monthExpenses, extraMonthIncome, topCategories };
  }, [transactions]);

  const plannedExpenses = recurringExpenses.reduce((sum, r) => sum + r.amount, 0);
  const totalMonthIncome = plannedIncome + stats.extraMonthIncome;

  const streak = profile?.current_streak ?? 0;
  const longestStreak = profile?.longest_streak ?? 0;

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-5 max-w-md mx-auto w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-1.5">
            Привет, {profile?.display_name ?? profile?.first_name}!
            {profile?.is_premium && <span title="Premium">⭐</span>}
          </h1>
          <p className="text-muted text-sm">Твой финансовый дашборд</p>
        </div>
        <CatMascot mood={catMoodForStreak(streak)} size={64} interactive />
      </div>

      {!profile?.is_premium && (
        <button
          onClick={handleBuyPremium}
          disabled={buyingPremium}
          className="rounded-2xl border border-accent/40 bg-accent/10 py-3 font-medium text-accent disabled:opacity-50"
        >
          {buyingPremium ? "Открываю оплату…" : "⭐ Получить Premium за 5 звёзд"}
        </button>
      )}

      <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-white/80 text-xs uppercase tracking-wide">Серия дней подряд</p>
          <p className="text-3xl font-extrabold">{streak} 🔥</p>
          <p className="text-white/70 text-xs mt-1">Рекорд: {longestStreak} дней</p>
        </div>
        <p className="text-white/80 text-xs max-w-[40%] text-right">Не пропусти день!</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card border border-card-border p-4">
          <p className="text-muted text-xs">Доход за месяц</p>
          <p className="text-lg font-bold text-emerald-500">+{formatMoney(totalMonthIncome)} ₽</p>
        </div>
        <div className="rounded-2xl bg-card border border-card-border p-4">
          <p className="text-muted text-xs">Расход за месяц</p>
          <p className="text-lg font-bold">−{formatMoney(stats.monthExpenses)} ₽</p>
        </div>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-4">
        <p className="text-muted text-xs mb-1">Планируемые ежемесячные расходы</p>
        <p className="text-2xl font-extrabold">{formatMoney(plannedExpenses)} ₽</p>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-4">
        <p className="text-muted text-xs mb-1">Траты за эту неделю</p>
        <p className="text-2xl font-extrabold">{formatMoney(stats.weekExpenses)} ₽</p>
      </div>

      <div className="rounded-2xl bg-card border border-card-border p-4">
        <p className="font-semibold mb-3">Топ категорий трат (месяц)</p>
        {stats.topCategories.length === 0 && (
          <p className="text-muted text-sm">Пока нет расходов за этот месяц</p>
        )}
        <div className="flex flex-col gap-2">
          {stats.topCategories.map(([name, amount]) => {
            const max = stats.topCategories[0][1];
            const width = Math.max(8, Math.round((amount / max) * 100));
            return (
              <div key={name}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{name}</span>
                  <span className="font-medium">{formatMoney(amount)} ₽</span>
                </div>
                <div className="h-2 rounded-full bg-background overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button
        onClick={handleExport}
        disabled={exporting}
        className="rounded-2xl border border-card-border bg-card py-3 font-medium disabled:opacity-50"
      >
        {exporting ? "Отправляю…" : "📊 Выгрузить отчёт в Excel"}
      </button>
      {exportMessage && <p className="text-muted text-sm text-center">{exportMessage}</p>}
    </main>
  );
}

export default function DashboardPage() {
  return (
    <AuthGate>
      <DashboardContent />
    </AuthGate>
  );
}
