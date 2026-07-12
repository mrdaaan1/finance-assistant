export type TelegramUser = {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
};

export type Profile = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  created_at: string;
};

export type TelegramAuthResponse = {
  access_token: string;
  refresh_token: string;
};

export type TransactionKind = "expense" | "income";

export type Category = {
  id: string;
  user_id: string | null;
  name: string;
  kind: TransactionKind;
  icon: string | null;
  is_system: boolean;
};

export type Transaction = {
  id: string;
  user_id: string;
  category_id: string | null;
  kind: TransactionKind;
  amount: number;
  occurred_on: string;
  comment: string | null;
  created_at: string;
  category?: Category | null;
};

export type RecurringExpense = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  starts_on: string;
  ends_on: string | null;
};

export type IncomeChangePayload = {
  new_monthly_income: number;
};

export type RecurringExpensePayload = {
  amount: number;
  duration_months: number | null;
  name: string;
};

export type LoanPayload = {
  principal: number;
  annual_rate_pct: number;
  term_months: number;
  extra_payment_monthly: number;
  name: string;
};

export type FinancialPlanEvent =
  | {
      id: string;
      user_id: string;
      event_type: "income_change";
      effective_from: string;
      payload: IncomeChangePayload;
    }
  | {
      id: string;
      user_id: string;
      event_type: "recurring_expense";
      effective_from: string;
      payload: RecurringExpensePayload;
    }
  | {
      id: string;
      user_id: string;
      event_type: "loan";
      effective_from: string;
      payload: LoanPayload;
    };

export type GoalType = "savings" | "down_payment";
export type GoalStatus = "active" | "achieved" | "archived";

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  goal_type: GoalType;
  linked_loan_event_id: string | null;
  status: GoalStatus;
  created_at: string;
};

export type AssetType = "real_estate" | "car" | "gadget" | "other";

export type Asset = {
  id: string;
  user_id: string;
  asset_type: AssetType;
  name: string;
  current_value: number;
  metadata: Record<string, unknown>;
  acquired_on: string | null;
};
