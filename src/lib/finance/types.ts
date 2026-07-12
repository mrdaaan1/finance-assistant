export type TelegramUser = {
  id: number;
  username?: string;
  first_name: string;
  last_name?: string;
  photo_url?: string;
};

export const AVATAR_OPTIONS = [
  { key: "cat", emoji: "🐱" },
  { key: "fox", emoji: "🦊" },
  { key: "panda", emoji: "🐼" },
  { key: "owl", emoji: "🦉" },
  { key: "rabbit", emoji: "🐰" },
  { key: "koala", emoji: "🐨" },
  { key: "tiger", emoji: "🐯" },
  { key: "penguin", emoji: "🐧" },
  { key: "hedgehog", emoji: "🦔" },
  { key: "frog", emoji: "🐸" },
  { key: "capybara", emoji: "🦫" },
] as const;

export type AvatarKey = (typeof AVATAR_OPTIONS)[number]["key"];

export function avatarEmoji(key: string | null): string {
  return AVATAR_OPTIONS.find((a) => a.key === key)?.emoji ?? "🐱";
}

export type Profile = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  avatar_url: string | null;
  display_name: string | null;
  avatar_key: string | null;
  onboarded: boolean;
  is_premium: boolean;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  created_at: string;
};

export type TelegramAuthResponse = {
  access_token: string;
  refresh_token: string;
};

export type TransactionKind = "expense" | "income" | "saving";

export type Category = {
  id: string;
  user_id: string | null;
  name: string;
  kind: "expense" | "income";
  icon: string | null;
  is_system: boolean;
};

export type Transaction = {
  id: string;
  user_id: string;
  category_id: string | null;
  goal_id: string | null;
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
  duration_months: number | null;
  is_active: boolean;
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

export type GoalStatus = "active" | "achieved" | "archived";

export type Goal = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  monthly_contribution: number;
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
