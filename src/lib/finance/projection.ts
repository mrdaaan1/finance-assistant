import type { FinancialPlanEvent, RecurringExpense } from "./types";

export type MonthlyProjectionPoint = {
  monthIndex: number;
  year: number;
  month: number;
  income: number;
  expenses: number;
  netCashFlow: number;
  cumulativeSavings: number;
};

export type ProjectionInput = {
  currentMonthlyIncome: number;
  currentMonthlyExpenses: number;
  startingSavings: number;
  recurringExpenses: RecurringExpense[];
  planEvents: FinancialPlanEvent[];
  horizonMonths: number;
  startDate?: Date;
};

export function calculateAnnuityPayment(
  principal: number,
  annualRatePct: number,
  termMonths: number,
): number {
  if (termMonths <= 0) return 0;
  const monthlyRate = annualRatePct / 100 / 12;
  if (monthlyRate === 0) return principal / termMonths;

  const factor = Math.pow(1 + monthlyRate, termMonths);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function amortizeLoanBalance(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  extraPaymentMonthly: number,
  monthsElapsed: number,
): { remainingBalance: number; monthlyPayment: number; payoffMonth: number | null } {
  const monthlyRate = annualRatePct / 100 / 12;
  const basePayment = calculateAnnuityPayment(principal, annualRatePct, termMonths);
  const monthlyPayment = basePayment + extraPaymentMonthly;

  let balance = principal;
  let payoffMonth: number | null = null;

  for (let month = 1; month <= monthsElapsed; month++) {
    if (balance <= 0) {
      if (payoffMonth === null) payoffMonth = month - 1;
      continue;
    }
    const interest = balance * monthlyRate;
    balance = balance + interest - monthlyPayment;
    if (balance <= 0) {
      balance = 0;
      payoffMonth = month;
    }
  }

  return { remainingBalance: balance, monthlyPayment, payoffMonth };
}

export type LoanSummary = {
  monthlyPayment: number;
  payoffMonth: number; // сколько месяцев реально потребуется с учётом допплатежей
  totalPaid: number;
  totalInterest: number; // переплата — то, что сверх суммы кредита
};

/**
 * Полная сводка по кредиту: считает месяц за месяцем до полного погашения
 * (в отличие от amortizeLoanBalance, которая ограничена monthsElapsed) —
 * нужно для карточки "сколько всего отдашь" и сравнения "без/с досрочкой".
 */
export function summarizeLoan(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  extraPaymentMonthly: number,
): LoanSummary {
  const monthlyRate = annualRatePct / 100 / 12;
  const basePayment = calculateAnnuityPayment(principal, annualRatePct, termMonths);
  const monthlyPayment = basePayment + extraPaymentMonthly;

  let balance = principal;
  let totalPaid = 0;
  let month = 0;
  // Защита от бесконечного цикла: если платёж не покрывает даже проценты
  // первого месяца, кредит математически никогда не будет погашен.
  const maxMonths = termMonths * 4 + 1200;

  while (balance > 0 && month < maxMonths) {
    month += 1;
    const interest = balance * monthlyRate;
    const payment = Math.min(monthlyPayment, balance + interest);
    balance = balance + interest - payment;
    totalPaid += payment;
    if (balance < 0.01) balance = 0;
  }

  return {
    monthlyPayment,
    payoffMonth: month,
    totalPaid,
    totalInterest: totalPaid - principal,
  };
}

/** Сумма ежемесячных платежей по всем кредитам, которые ещё не погашены на дату `now`. */
export function activeLoanMonthlyPayment(loanEvents: Extract<FinancialPlanEvent, { event_type: "loan" }>[], now: Date = new Date()): number {
  let total = 0;
  for (const event of loanEvents) {
    const effectiveFrom = new Date(event.effective_from);
    const eventMonthStart = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    if (currentMonthStart < eventMonthStart) continue;

    const monthsSinceStart = monthsBetween(eventMonthStart, currentMonthStart) + 1;
    const { principal, annual_rate_pct, term_months, extra_payment_monthly } = event.payload;
    const { monthlyPayment, payoffMonth } = amortizeLoanBalance(
      principal,
      annual_rate_pct,
      term_months,
      extra_payment_monthly,
      monthsSinceStart,
    );
    if (payoffMonth === null || monthsSinceStart <= payoffMonth) {
      total += monthlyPayment;
    }
  }
  return total;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth() + months, 1);
  return result;
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  );
}

export function buildMonthlyProjection(input: ProjectionInput): MonthlyProjectionPoint[] {
  const startDate = input.startDate ?? new Date();
  const points: MonthlyProjectionPoint[] = [];
  let cumulativeSavings = input.startingSavings;

  for (let monthIndex = 0; monthIndex < input.horizonMonths; monthIndex++) {
    const cursor = addMonths(startDate, monthIndex);

    let income = input.currentMonthlyIncome;
    const incomeChangeEvents = input.planEvents
      .filter((event): event is Extract<FinancialPlanEvent, { event_type: "income_change" }> =>
        event.event_type === "income_change",
      )
      .sort((a, b) => a.effective_from.localeCompare(b.effective_from));
    for (const event of incomeChangeEvents) {
      const effectiveFrom = new Date(event.effective_from);
      const eventMonthStart = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
      if (cursor >= eventMonthStart) {
        income = event.payload.new_monthly_income;
      }
    }

    let expenses = input.currentMonthlyExpenses;

    for (const recurring of input.recurringExpenses) {
      const startsOn = new Date(recurring.starts_on);
      const endsOn = recurring.ends_on ? new Date(recurring.ends_on) : null;
      const startsMonth = new Date(startsOn.getFullYear(), startsOn.getMonth(), 1);
      const alreadyStarted = cursor >= startsMonth;
      const notEnded = !endsOn || cursor <= new Date(endsOn.getFullYear(), endsOn.getMonth(), 1);
      if (alreadyStarted && notEnded) {
        expenses += recurring.amount;
      }
    }

    for (const event of input.planEvents) {
      const effectiveFrom = new Date(event.effective_from);
      const eventMonthStart = new Date(effectiveFrom.getFullYear(), effectiveFrom.getMonth(), 1);
      if (cursor < eventMonthStart) continue;

      if (event.event_type === "recurring_expense") {
        const { duration_months, amount } = event.payload;
        const monthsSinceStart = monthsBetween(eventMonthStart, cursor);
        if (duration_months === null || monthsSinceStart < duration_months) {
          expenses += amount;
        }
      }

      if (event.event_type === "loan") {
        const monthsSinceStart = monthsBetween(eventMonthStart, cursor) + 1;
        const { principal, annual_rate_pct, term_months, extra_payment_monthly } = event.payload;
        const { monthlyPayment, payoffMonth } = amortizeLoanBalance(
          principal,
          annual_rate_pct,
          term_months,
          extra_payment_monthly,
          monthsSinceStart,
        );
        if (payoffMonth === null || monthsSinceStart <= payoffMonth) {
          expenses += monthlyPayment;
        }
      }
    }

    const netCashFlow = income - expenses;
    cumulativeSavings += netCashFlow;

    points.push({
      monthIndex,
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      income,
      expenses,
      netCashFlow,
      cumulativeSavings,
    });
  }

  return points;
}

export function findMonthGoalReached(
  projection: MonthlyProjectionPoint[],
  targetAmount: number,
): MonthlyProjectionPoint | null {
  return projection.find((point) => point.cumulativeSavings >= targetAmount) ?? null;
}

export type GoalMonthlyPoint = {
  monthIndex: number;
  year: number;
  month: number;
  cumulativeSaved: number;
};

export function buildGoalProjection(
  alreadySaved: number,
  monthlyContribution: number,
  targetAmount: number,
  startDate: Date = new Date(),
  maxMonths = 360,
): { points: GoalMonthlyPoint[]; reachedAt: GoalMonthlyPoint | null } {
  const points: GoalMonthlyPoint[] = [];
  let cumulative = alreadySaved;
  let reachedAt: GoalMonthlyPoint | null = null;

  if (alreadySaved >= targetAmount) {
    const cursor = addMonths(startDate, 0);
    reachedAt = { monthIndex: 0, year: cursor.getFullYear(), month: cursor.getMonth() + 1, cumulativeSaved: cumulative };
    return { points, reachedAt };
  }

  if (monthlyContribution <= 0) {
    return { points, reachedAt: null };
  }

  for (let monthIndex = 1; monthIndex <= maxMonths; monthIndex++) {
    const cursor = addMonths(startDate, monthIndex);
    cumulative += monthlyContribution;

    const point: GoalMonthlyPoint = {
      monthIndex,
      year: cursor.getFullYear(),
      month: cursor.getMonth() + 1,
      cumulativeSaved: cumulative,
    };
    points.push(point);

    if (!reachedAt && cumulative >= targetAmount) {
      reachedAt = point;
    }
  }

  return { points, reachedAt };
}
