-- Finance Assistant: анонимный ник/аватар, отложения на цель, срок регулярных трат

alter table public.profiles
  add column if not exists display_name text,
  add column if not exists avatar_key text,
  add column if not exists onboarded boolean not null default false;

alter table public.transactions
  add column if not exists goal_id uuid references public.goals(id) on delete set null;

alter table public.transactions drop constraint if exists transactions_kind_check;
alter table public.transactions add constraint transactions_kind_check
  check (kind in ('expense', 'income', 'saving'));

alter table public.recurring_expenses
  add column if not exists duration_months integer,
  add column if not exists is_active boolean not null default true;

alter table public.goals drop column if exists goal_type;
alter table public.goals drop column if exists linked_loan_event_id;

alter table public.goals
  add column if not exists monthly_contribution numeric(14, 2) not null default 0;
