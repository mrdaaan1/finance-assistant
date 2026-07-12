"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";
import type { Category, Transaction, TransactionKind } from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

function TransactionsPageContent() {
  const { supabase, profile, refreshProfile } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function loadData() {
    const [{ data: txs }, { data: cats }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id, user_id, category_id, kind, amount, occurred_on, comment, created_at, category:categories(id, user_id, name, kind, icon, is_system)")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("categories")
        .select("id, user_id, name, kind, icon, is_system")
        .order("name"),
    ]);

    if (txs) setTransactions(txs as unknown as Transaction[]);
    if (cats) setCategories(cats as Category[]);
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredCategories = categories.filter((c) => c.kind === kind);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !amount) return;

    setSubmitting(true);
    const { error } = await supabase.from("transactions").insert({
      user_id: profile.id,
      category_id: categoryId || null,
      kind,
      amount: Number(amount),
      occurred_on: new Date().toISOString().slice(0, 10),
      comment: comment || null,
    });
    setSubmitting(false);

    if (!error) {
      setAmount("");
      setComment("");
      await Promise.all([loadData(), refreshProfile()]);
    }
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">Траты и доходы</h1>

      <form
        onSubmit={handleSubmit}
        className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3 shadow-sm"
      >
        <div className="flex rounded-xl overflow-hidden border border-card-border">
          {(["expense", "income"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setCategoryId("");
              }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                kind === k ? "bg-accent text-white" : "bg-transparent text-muted"
              }`}
            >
              {k === "expense" ? "Расход" : "Доход"}
            </button>
          ))}
        </div>

        <input
          type="number"
          inputMode="decimal"
          placeholder="Сумма, ₽"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          required
          min="0.01"
          step="0.01"
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
        />

        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-xl border border-card-border bg-background px-3 py-2 text-base outline-none focus:border-accent"
        >
          <option value="">Без категории</option>
          {filteredCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

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
              <span className="font-medium">{tx.category?.name ?? "Без категории"}</span>
              <span className="text-xs text-muted">
                {new Date(tx.occurred_on).toLocaleDateString("ru-RU")}
                {tx.comment ? ` · ${tx.comment}` : ""}
              </span>
            </div>
            <span
              className={`font-semibold ${tx.kind === "income" ? "text-emerald-500" : "text-foreground"}`}
            >
              {tx.kind === "income" ? "+" : "−"}
              {formatMoney(tx.amount)} ₽
            </span>
          </div>
        ))}
      </div>
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
