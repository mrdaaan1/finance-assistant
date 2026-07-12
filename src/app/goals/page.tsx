"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";
import { buildMonthlyProjection, findMonthGoalReached } from "@/lib/finance/projection";
import type {
  FinancialPlanEvent,
  Goal,
  GoalType,
  RecurringExpense,
} from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

const MONTH_NAMES = [
  "янв", "фев", "мар", "апр", "май", "июн",
  "июл", "авг", "сен", "окт", "ноя", "дек",
];

function GoalsPageContent() {
  const { supabase, profile } = useSession();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [planEvents, setPlanEvents] = useState<FinancialPlanEvent[]>([]);
  const [currentIncome, setCurrentIncome] = useState<number | null>(null);

  const [goalName, setGoalName] = useState("");
  const [goalAmount, setGoalAmount] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("savings");
  const [goalSubmitting, setGoalSubmitting] = useState(false);

  const [incomeInput, setIncomeInput] = useState("");
  const [expenseName, setExpenseName] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");

  async function loadAll() {
    const [{ data: goalsData }, { data: recurringData }, { data: eventsData }] =
      await Promise.all([
        supabase.from("goals").select("*").eq("status", "active").order("created_at"),
        supabase.from("recurring_expenses").select("*").order("starts_on"),
        supabase
          .from("financial_plan_events")
          .select("*")
          .order("effective_from"),
      ]);

    if (goalsData) setGoals(goalsData as Goal[]);
    if (recurringData) setRecurringExpenses(recurringData as RecurringExpense[]);
    if (eventsData) {
      const events = eventsData as FinancialPlanEvent[];
      setPlanEvents(events);
      const incomeEvents = events.filter((e) => e.event_type === "income_change");
      if (incomeEvents.length > 0) {
        const latest = incomeEvents[incomeEvents.length - 1];
        if (latest.event_type === "income_change") {
          setCurrentIncome(latest.payload.new_monthly_income);
        }
      }
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
      effective_from: new Date().toISOString().slice(0, 10),
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
      starts_on: new Date().toISOString().slice(0, 10),
    });

    setExpenseName("");
    setExpenseAmount("");
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
      goal_type: goalType,
    });
    setGoalSubmitting(false);

    setGoalName("");
    setGoalAmount("");
    await loadAll();
  }

  const monthlyIncome = currentIncome ?? 0;
  const monthlyExpenses = recurringExpenses.reduce((sum, r) => sum + r.amount, 0);

  const projection = buildMonthlyProjection({
    currentMonthlyIncome: monthlyIncome,
    currentMonthlyExpenses: monthlyExpenses,
    startingSavings: 0,
    recurringExpenses,
    planEvents,
    horizonMonths: 240,
  });

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold">Цели и план</h1>

      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <p className="font-semibold">Мой доход</p>
        <p className="text-2xl font-extrabold">
          {monthlyIncome > 0 ? `${formatMoney(monthlyIncome)} ₽/мес` : "Не указан"}
        </p>
        <form onSubmit={handleSetIncome} className="flex gap-2">
          <input
            type="number"
            inputMode="decimal"
            placeholder="Новая зарплата, ₽/мес"
            value={incomeInput}
            onChange={(e) => setIncomeInput(e.target.value)}
            className="flex-1 rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="rounded-xl bg-accent text-white px-4 text-sm font-medium"
          >
            Указать
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <p className="font-semibold">Ежемесячные обязательные траты</p>
        <p className="text-lg font-bold">{formatMoney(monthlyExpenses)} ₽/мес</p>
        <div className="flex flex-col gap-1">
          {recurringExpenses.map((r) => (
            <div key={r.id} className="flex justify-between text-sm">
              <span>{r.name}</span>
              <span className="font-medium">{formatMoney(r.amount)} ₽</span>
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
          <div className="flex gap-2">
            <input
              type="number"
              inputMode="decimal"
              placeholder="Сумма, ₽/мес"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              className="flex-1 rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="rounded-xl bg-accent text-white px-4 text-sm font-medium"
            >
              Добавить
            </button>
          </div>
        </form>
      </section>

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
          <input
            type="number"
            inputMode="decimal"
            placeholder="Нужная сумма, ₽"
            value={goalAmount}
            onChange={(e) => setGoalAmount(e.target.value)}
            className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value as GoalType)}
            className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          >
            <option value="savings">Накопление</option>
            <option value="down_payment">Первоначальный взнос</option>
          </select>
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
          const reachedPoint = findMonthGoalReached(projection, goal.target_amount);
          return (
            <div
              key={goal.id}
              className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-2"
            >
              <p className="font-semibold">{goal.name}</p>
              <p className="text-muted text-sm">
                Нужно накопить {formatMoney(goal.target_amount)} ₽
              </p>
              {reachedPoint ? (
                <p className="text-accent font-bold">
                  Достижимо к {MONTH_NAMES[reachedPoint.month - 1]} {reachedPoint.year}
                </p>
              ) : (
                <p className="text-muted text-sm">
                  При текущих доходах и тратах цель не достигается за 20 лет — укажи
                  доход и расходы точнее
                </p>
              )}
            </div>
          );
        })}
        {goals.length === 0 && (
          <p className="text-muted text-center py-6">Пока нет активных целей</p>
        )}
      </section>
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
