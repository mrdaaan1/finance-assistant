"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { MoneyInput } from "@/components/MoneyInput";
import { SegmentedSelect } from "@/components/SegmentedSelect";
import { StreakModal } from "@/components/StreakModal";
import { useSession } from "@/lib/finance/session-context";
import { todayLocalDateString } from "@/lib/finance/date-utils";
import type { Category, Goal, Transaction, TransactionKind } from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

const KIND_OPTIONS = [
  { value: "expense" as const, label: "Расход", icon: "💸" },
  { value: "income" as const, label: "Доход", icon: "💰" },
  { value: "saving" as const, label: "Отложить", icon: "🎯" },
];

function TransactionsPageContent() {
  const { supabase, profile, refreshProfile } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [goalId, setGoalId] = useState<string>("");
  const [occurredOn, setOccurredOn] = useState(todayLocalDateString());
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [streakToShow, setStreakToShow] = useState<number | null>(null);

  async function loadData() {
    const [{ data: txs }, { data: cats }, { data: goalsData }] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, user_id, category_id, goal_id, kind, amount, occurred_on, comment, created_at, category:categories(id, user_id, name, kind, icon, is_system)",
        )
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("categories").select("id, user_id, name, kind, icon, is_system").order("name"),
      supabase.from("goals").select("*").eq("status", "active").order("created_at"),
    ]);

    if (txs) setTransactions(txs as unknown as Transaction[]);
    if (cats) setCategories(cats as Category[]);
    if (goalsData) setGoals(goalsData as Goal[]);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCategories = categories.filter((c) => c.kind === (kind === "saving" ? "expense" : kind));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !amount) return;

    setSubmitting(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: profile.id,
      category_id: kind === "saving" ? null : categoryId || null,
      goal_id: kind === "saving" ? goalId || null : null,
      kind,
      amount: Number(amount),
      occurred_on: occurredOn,
      comment: comment || null,
    });

    if (!error) {
      const previousStreak = profile.current_streak;
      setAmount("");
      setComment("");
      await Promise.all([loadData(), refreshProfile()]);

      const { data: refreshed } = await supabase
        .from("profiles")
        .select("current_streak")
        .eq("id", profile.id)
        .maybeSingle();

      const newStreak = refreshed?.current_streak ?? previousStreak;
      if (newStreak > previousStreak) {
        setStreakToShow(newStreak);
      }
    }
    setSubmitting(false);
  }

  async function handleDelete(id: string) {
    await supabase.from("transactions").delete().eq("id", id);
    await loadData();
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">Траты и доходы</h1>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3 shadow-sm"
      >
        <SegmentedSelect
          options={KIND_OPTIONS}
          value={kind}
          onChange={(v) => {
            setKind(v);
            setCategoryId("");
            setGoalId("");
          }}
        />

        <MoneyInput
          value={amount}
          onChange={setAmount}
          placeholder="Сумма"
          className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-base outline-none focus:border-accent w-full"
        />

        {kind === "saving" ? (
          goals.length > 0 ? (
            <SegmentedSelect
              options={goals.map((g) => ({ value: g.id, label: g.name }))}
              value={goalId}
              onChange={setGoalId}
              columns={Math.min(goals.length, 2)}
            />
          ) : (
            <p className="text-muted text-sm">
              Сначала создай цель в разделе «Цели», чтобы откладывать на неё
            </p>
          )
        ) : (
          <SegmentedSelect
            options={[
              { value: "", label: "Без категории" },
              ...filteredCategories.map((c) => ({ value: c.id, label: c.name, icon: c.icon ?? undefined })),
            ]}
            value={categoryId}
            onChange={setCategoryId}
            columns={3}
          />
        )}

        <input
          type="date"
          value={occurredOn}
          max={todayLocalDateString()}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
        />

        <input
          type="text"
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
        />

        <button
          type="submit"
          disabled={submitting || !amount}
          className="rounded-xl bg-accent text-white py-2 font-medium disabled:opacity-50"
        >
          {submitting ? "Добавляю…" : "Добавить"}
        </button>
      </form>

      <div className="flex flex-col gap-2">
        {transactions.length === 0 && (
          <p className="text-muted text-center py-8">Пока нет операций</p>
        )}
        {transactions.map((tx) => (
          <div
            key={tx.id}
            className="flex items-center justify-between rounded-xl bg-card border border-card-border px-4 py-3"
          >
            <div className="flex flex-col">
              <span className="font-medium">
                {tx.kind === "saving" ? "Отложение" : tx.category?.name ?? "Без категории"}
              </span>
              <span className="text-xs text-muted">
                {new Date(tx.occurred_on).toLocaleDateString("ru-RU")}
                {tx.comment ? ` · ${tx.comment}` : ""}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`font-semibold ${
                  tx.kind === "income" ? "text-emerald-500" : tx.kind === "saving" ? "text-accent" : "text-foreground"
                }`}
              >
                {tx.kind === "income" ? "+" : tx.kind === "saving" ? "→" : "−"}
                {formatMoney(tx.amount)} ₽
              </span>
              <button
                onClick={() => handleDelete(tx.id)}
                aria-label="Удалить"
                className="text-muted hover:text-red-500 transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>

      {streakToShow !== null && (
        <StreakModal streak={streakToShow} onClose={() => setStreakToShow(null)} />
      )}
    </main>
  );
}

export default function TransactionsPage() {
  return (
    <AuthGate>
      <TransactionsPageContent />
    </AuthGate>
  );
}
