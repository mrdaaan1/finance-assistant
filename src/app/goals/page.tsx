"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { MoneyInput } from "@/components/MoneyInput";
import { SegmentedSelect } from "@/components/SegmentedSelect";
import { LoansTab } from "@/components/LoansTab";
import { useSession } from "@/lib/finance/session-context";
import { buildGoalProjection } from "@/lib/finance/projection";
import { todayLocalDateString } from "@/lib/finance/date-utils";
import type { FinancialPlanEvent, Goal, RecurringExpense } from "@/lib/finance/types";

type LoanEvent = Extract<FinancialPlanEvent, { event_type: "loan" }>;
type SectionKey = "plan" | "goals" | "loans";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

const MONTH_NAMES = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function GoalsPageContent() {
  const { supabase, profile } = useSession();

  const [section, setSection] = useState<SectionKey>("plan");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [loans, setLoans] = useState<LoanEvent[]>([]);
  const [savingsByGoal, setSavingsByGoal] = useState<Record<string, number>>({});
  const [currentIncome, setCurrentIncome] = useState<number | null>(null);

  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalContribution, setGoalContribution] = useState("");
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  const [incomeInput, setIncomeInput] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDuration, setExpenseDuration] = useState<"forever" | "limited">("forever");
  const [expenseMonths, setExpenseMonths] = useState("12");

  async function loadAll() {
    const [{ data: goalsData }, { data: recurringData }, { data: eventsData }, { data: savingTxs }] =
      await Promise.all([
        supabase.from("goals").select("*").eq("status", "active").order("created_at"),
        supabase
          .from("recurring_expenses")
          .select("*")
          .eq("is_active", true)
          .order("starts_on"),
        supabase.from("financial_plan_events").select("*").order("effective_from"),
        supabase.from("transactions").select("goal_id, amount").eq("kind", "saving"),
      ]);

    if (goalsData) setGoals(goalsData as Goal[]);
    if (recurringData) setRecurringExpenses(recurringData as RecurringExpense[]);
    if (eventsData) {
      const events = eventsData as FinancialPlanEvent[];
      const incomeEvents = events.filter(
        (e): e is Extract<FinancialPlanEvent, { event_type: "income_change" }> => e.event_type === "income_change",
      );
      if (incomeEvents.length > 0) {
        setCurrentIncome(incomeEvents[incomeEvents.length - 1].payload.new_monthly_income ?? null);
      }
      setLoans(events.filter((e): e is LoanEvent => e.event_type === "loan"));
    }
    if (savingTxs) {
      const totals: Record<string, number> = {};
      for (const tx of savingTxs as { goal_id: string | null; amount: number }[]) {
        if (!tx.goal_id) continue;
        totals[tx.goal_id] = (totals[tx.goal_id] ?? 0) + tx.amount;
      }
      setSavingsByGoal(totals);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSetIncome(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !incomeInput) return;

    await supabase.from("financial_plan_events").insert({
      user_id: profile.id,
      event_type: "income_change",
      effective_from: todayLocalDateString(),
      payload: { new_monthly_income: Number(incomeInput) },
    });

    setIncomeInput("");
    await loadAll();
  }

  async function handleAddRecurringExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !expenseName || !expenseAmount) return;

    await supabase.from("recurring_expenses").insert({
      user_id: profile.id,
      name: expenseName,
      amount: Number(expenseAmount),
      starts_on: todayLocalDateString(),
      duration_months: expenseDuration === "limited" ? Number(expenseMonths) : null,
    });

    setExpenseName("");
    setExpenseAmount("");
    setExpenseDuration("forever");
    setExpenseMonths("12");
    await loadAll();
  }

  async function handleDeleteRecurringExpense(id: string) {
    await supabase.from("recurring_expenses").delete().eq("id", id);
    await loadAll();
  }

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!profile || !goalName || !goalAmount) return;

    setGoalSubmitting(true);
    await supabase.from("goals").insert({
      user_id: profile.id,
      name: goalName,
      target_amount: Number(goalAmount),
      monthly_contribution: Number(goalContribution) || 0,
    });
    setGoalSubmitting(false);

    setGoalName("");
    setGoalAmount("");
    setGoalContribution("");
    await loadAll();
  }

  async function handleDeleteGoal(id: string) {
    await supabase.from("goals").delete().eq("id", id);
    await loadAll();
  }

  async function handleUpdateContribution(goal: Goal, value: string) {
    const amount = Number(value) || 0;
    await supabase.from("goals").update({ monthly_contribution: amount }).eq("id", goal.id);
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, monthly_contribution: amount } : g)));
  }

  const monthlyIncome = currentIncome ?? 0;
  const monthlyExpenses = recurringExpenses.reduce((sum, r) => sum + r.amount, 0);

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">Цели и план</h1>

      <SegmentedSelect
        options={[
          { value: "plan" as const, label: "Доход и траты" },
          { value: "goals" as const, label: "Цели" },
          { value: "loans" as const, label: "Кредиты" },
        ]}
        value={section}
        onChange={setSection}
        columns={3}
      />

      {section === "loans" && profile && (
        <LoansTab supabase={supabase} userId={profile.id} loans={loans} onChanged={loadAll} />
      )}

      {section === "plan" && (
      <>
      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <p className="font-semibold">Мой доход</p>
        <p className="text-2xl font-extrabold">
          {monthlyIncome > 0 ? `${formatMoney(monthlyIncome)} ₽/мес` : "Не указан"}
        </p>
        <form onSubmit={handleSetIncome} className="flex gap-2">
          <MoneyInput
            value={incomeInput}
            onChange={setIncomeInput}
            placeholder="Новая зарплата"
            className="flex-1 rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
          />
          <button type="submit" className="rounded-xl bg-accent text-white px-4 text-sm font-medium">
            Указать
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <p className="font-semibold">Ежемесячные обязательные траты</p>
        <p className="text-lg font-bold">{formatMoney(monthlyExpenses)} ₽/мес</p>
        <div className="flex flex-col gap-1">
          {recurringExpenses.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-sm">
              <div className="flex flex-col">
                <span>{r.name}</span>
                <span className="text-xs text-muted">
                  {r.duration_months ? `ещё ${r.duration_months} мес.` : "постоянно"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-medium">{formatMoney(r.amount)} ₽</span>
                <button
                  onClick={() => handleDeleteRecurringExpense(r.id)}
                  aria-label="Удалить"
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
        <form onSubmit={handleAddRecurringExpense} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Название (аренда, связь…)"
            value={expenseName}
            onChange={(e) => setExpenseName(e.target.value)}
            className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <MoneyInput
            value={expenseAmount}
            onChange={setExpenseAmount}
            placeholder="Сумма в месяц"
            className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
          />
          <SegmentedSelect
            options={[
              { value: "forever" as const, label: "Постоянно" },
              { value: "limited" as const, label: "Ограниченный срок" },
            ]}
            value={expenseDuration}
            onChange={setExpenseDuration}
            columns={2}
          />
          {expenseDuration === "limited" && (
            <input
              type="number"
              min="1"
              placeholder="Сколько месяцев"
              value={expenseMonths}
              onChange={(e) => setExpenseMonths(e.target.value)}
              className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
          )}
          <button
            type="submit"
            className="rounded-xl bg-accent text-white py-2 text-sm font-medium"
          >
            Добавить
          </button>
        </form>
      </section>
      </>
      )}

      {section === "goals" && (
      <>
      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <p className="font-semibold">Новая цель</p>
        <form onSubmit={handleAddGoal} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Название цели"
            value={goalName}
            onChange={(e) => setGoalName(e.target.value)}
            className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <MoneyInput
            value={goalAmount}
            onChange={setGoalAmount}
            placeholder="Нужная сумма"
            className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
          />
          <MoneyInput
            value={goalContribution}
            onChange={setGoalContribution}
            placeholder="Сколько откладывать в месяц"
            className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
          />
          <button
            type="submit"
            disabled={goalSubmitting}
            className="rounded-xl bg-accent text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            Создать цель
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        {goals.map((goal) => {
          const alreadySaved = savingsByGoal[goal.id] ?? 0;
          const { reachedAt } = buildGoalProjection(
            alreadySaved,
            goal.monthly_contribution,
            goal.target_amount,
          );
          const progressPct = Math.min(100, Math.round((alreadySaved / goal.target_amount) * 100));

          return (
            <div
              key={goal.id}
              className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{goal.name}</p>
                  <p className="text-muted text-sm">
                    {formatMoney(alreadySaved)} из {formatMoney(goal.target_amount)} ₽
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteGoal(goal.id)}
                  aria-label="Удалить цель"
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="h-2 rounded-full bg-background overflow-hidden">
                <div className="h-full rounded-full bg-accent" style={{ width: `${progressPct}%` }} />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted">Откладываю в месяц:</span>
                <MoneyInput
                  value={String(goal.monthly_contribution || "")}
                  onChange={(v) => handleUpdateContribution(goal, v)}
                  placeholder="0"
                  className="flex-1 rounded-lg border border-card-border bg-background px-2 py-1 pr-6 text-sm outline-none focus:border-accent w-full"
                />
              </div>

              {goal.monthly_contribution <= 0 ? (
                <p className="text-muted text-sm">
                  Укажи сумму ежемесячного отложения, чтобы увидеть прогноз
                </p>
              ) : reachedAt ? (
                <p className="text-accent font-bold">
                  При {formatMoney(goal.monthly_contribution)} ₽/мес достигнешь цели в{" "}
                  {MONTH_NAMES[reachedAt.month - 1]} {reachedAt.year}
                </p>
              ) : (
                <p className="text-muted text-sm">
                  При текущей сумме отложения цель не достигается за 30 лет
                </p>
              )}
            </div>
          );
        })}
        {goals.length === 0 && (
          <p className="text-muted text-center py-6">Пока нет активных целей</p>
        )}
      </section>
      </>
      )}
    </main>
  );
}

export default function GoalsPage() {
  return (
    <AuthGate>
      <GoalsPageContent />
    </AuthGate>
  );
}
