"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { MoneyInput } from "./MoneyInput";
import { InfoTip } from "./InfoTip";
import { summarizeLoan } from "@/lib/finance/projection";
import { todayLocalDateString } from "@/lib/finance/date-utils";
import type { FinancialPlanEvent, LoanPayload } from "@/lib/finance/types";

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(amount));
}

function formatDuration(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "год" : years < 5 ? "года" : "лет"}`);
  if (rest > 0) parts.push(`${rest} мес.`);
  return parts.join(" ") || "0 мес.";
}

type LoanEvent = Extract<FinancialPlanEvent, { event_type: "loan" }>;

export function LoansTab({
  supabase,
  userId,
  loans,
  onChanged,
}: {
  supabase: SupabaseClient;
  userId: string;
  loans: LoanEvent[];
  onChanged: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [termMonths, setTermMonths] = useState("");
  const [extraPayment, setExtraPayment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleAddLoan(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !principal || !rate || !termMonths) return;

    setSubmitting(true);
    const payload: LoanPayload = {
      name,
      principal: Number(principal),
      annual_rate_pct: Number(rate),
      term_months: Number(termMonths),
      extra_payment_monthly: Number(extraPayment) || 0,
    };

    await supabase.from("financial_plan_events").insert({
      user_id: userId,
      event_type: "loan",
      effective_from: todayLocalDateString(),
      payload,
    });

    setName("");
    setPrincipal("");
    setRate("");
    setTermMonths("");
    setExtraPayment("");
    setSubmitting(false);
    await onChanged();
  }

  async function handleDeleteLoan(id: string) {
    await supabase.from("financial_plan_events").delete().eq("id", id);
    await onChanged();
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <div>
          <p className="font-semibold">Что такое кредит и досрочное погашение?</p>
          <p className="text-muted text-sm mt-1 leading-snug">
            Банк даёт тебе сумму (тело долга) сейчас, а ты возвращаешь её частями плюс проценты
            за пользование деньгами. Большинство кредитов и ипотек в России — аннуитетные:
            каждый месяц платёж одинаковый, но в начале срока в нём больше процентов, а в конце —
            больше тела долга. Досрочное погашение — доплата сверх графика, которая сразу уменьшает
            тело долга. Чем раньше вносишь допплатёж, тем меньше процентов набежит в будущем —
            это сокращает и переплату, и срок кредита.
          </p>
        </div>
      </section>

      <section className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
        <p className="font-semibold">Добавить кредит или ипотеку</p>
        <form onSubmit={handleAddLoan} className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="Название (ипотека, автокредит…)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
          />

          <div>
            <MoneyInput
              value={principal}
              onChange={setPrincipal}
              placeholder="Сумма кредита (тело долга)"
              className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
            />
            <p className="text-muted text-xs mt-1 px-1">
              Сколько денег банк выдал тебе на руки (или за тебя продавцу) — без процентов
            </p>
          </div>

          <div>
            <div className="relative">
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                placeholder="Процентная ставка в год, %"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="w-full rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">%</span>
            </div>
            <p className="text-muted text-xs mt-1 px-1">
              Указана в договоре с банком. Чем выше ставка — тем больше переплата за одну и ту же сумму
              <InfoTip>
                Ставка 12% годовых на 1 млн ₽ на 10 лет даёт переплату около 730 000 ₽. При 20% годовых
                переплата вырастет почти вдвое — вот почему стоит сравнивать ставки перед оформлением.
              </InfoTip>
            </p>
          </div>

          <div>
            <input
              type="number"
              placeholder="Срок кредита, месяцев"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className="w-full rounded-xl border border-card-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <p className="text-muted text-xs mt-1 px-1">Например, ипотека на 20 лет = 240 месяцев</p>
          </div>

          <div>
            <MoneyInput
              value={extraPayment}
              onChange={setExtraPayment}
              placeholder="Доп. платёж в месяц (необязательно)"
              className="rounded-xl border border-card-border bg-background px-3 py-2 pr-8 text-sm outline-none focus:border-accent w-full"
            />
            <p className="text-muted text-xs mt-1 px-1">
              Если планируешь гасить досрочно каждый месяц одной и той же суммой — укажи её здесь,
              и мы покажем, насколько раньше закроешь кредит и сколько сэкономишь на процентах
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-accent text-white py-2 text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "Добавляю…" : "Добавить кредит"}
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        {loans.map((loan) => {
          const { principal: p, annual_rate_pct, term_months, extra_payment_monthly, name: loanName } = loan.payload;

          const withoutExtra = summarizeLoan(p, annual_rate_pct, term_months, 0);
          const withExtra =
            extra_payment_monthly > 0 ? summarizeLoan(p, annual_rate_pct, term_months, extra_payment_monthly) : null;

          const monthsSaved = withExtra ? withoutExtra.payoffMonth - withExtra.payoffMonth : 0;
          const interestSaved = withExtra ? withoutExtra.totalInterest - withExtra.totalInterest : 0;

          return (
            <div key={loan.id} className="rounded-2xl bg-card border border-card-border p-4 flex flex-col gap-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{loanName}</p>
                  <p className="text-muted text-sm">
                    {formatMoney(p)} ₽ на {formatDuration(term_months)} под {annual_rate_pct}% годовых
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteLoan(loan.id)}
                  aria-label="Удалить кредит"
                  className="text-muted hover:text-red-500 transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-background p-3">
                  <p className="text-muted text-xs">Ежемесячный платёж</p>
                  <p className="font-bold">{formatMoney(withoutExtra.monthlyPayment)} ₽</p>
                </div>
                <div className="rounded-xl bg-background p-3">
                  <p className="text-muted text-xs">
                    Переплата за весь срок
                    <InfoTip>
                      Это проценты сверх суммы кредита — то, что банк заработает на тебе, если платить
                      строго по графику без досрочных платежей.
                    </InfoTip>
                  </p>
                  <p className="font-bold">{formatMoney(withoutExtra.totalInterest)} ₽</p>
                </div>
              </div>

              <div className="h-2 rounded-full bg-background overflow-hidden flex">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.round((p / withoutExtra.totalPaid) * 100)}%` }}
                  title="Тело долга"
                />
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${Math.round((withoutExtra.totalInterest / withoutExtra.totalPaid) * 100)}%` }}
                  title="Переплата"
                />
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>■ Тело долга {formatMoney(p)} ₽</span>
                <span>■ Переплата {formatMoney(withoutExtra.totalInterest)} ₽</span>
              </div>

              {withExtra && monthsSaved > 0 && (
                <div className="rounded-xl bg-accent/10 border border-accent/30 p-3">
                  <p className="text-accent font-semibold text-sm mb-1">
                    С доп. платежом {formatMoney(extra_payment_monthly)} ₽/мес:
                  </p>
                  <p className="text-sm">
                    Закроешь кредит на <b>{formatDuration(monthsSaved)} раньше</b> и сэкономишь{" "}
                    <b>{formatMoney(interestSaved)} ₽</b> на процентах
                  </p>
                </div>
              )}
            </div>
          );
        })}
        {loans.length === 0 && (
          <p className="text-muted text-center py-6">Пока нет добавленных кредитов</p>
        )}
      </section>
    </div>
  );
}
