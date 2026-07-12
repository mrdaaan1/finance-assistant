-- Finance Assistant: основной функционал (транзакции, цели, активы, план, streak)

alter table public.profiles
  add column if not exists current_streak integer not null default 0,
  add column if not exists longest_streak integer not null default 0,
  add column if not exists last_active_date date;

-- Категории трат/доходов
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('expense', 'income')),
  icon text,
  is_system boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists categories_user_id_idx on public.categories (user_id);

alter table public.categories enable row level security;

create policy "categories_select"
  on public.categories for select
  to authenticated
  using (is_system or user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Системные категории по умолчанию (общие для всех, user_id = null)
insert into public.categories (user_id, name, kind, icon, is_system) values
  (null, 'Еда и кафе', 'expense', 'utensils', true),
  (null, 'Транспорт', 'expense', 'car', true),
  (null, 'Жильё', 'expense', 'home', true),
  (null, 'Развлечения', 'expense', 'party-popper', true),
  (null, 'Здоровье', 'expense', 'heart-pulse', true),
  (null, 'Покупки', 'expense', 'shopping-bag', true),
  (null, 'Прочее', 'expense', 'more-horizontal', true),
  (null, 'Зарплата', 'income', 'wallet', true),
  (null, 'Подработка', 'income', 'briefcase', true),
  (null, 'Прочий доход', 'income', 'plus-circle', true)
on conflict do nothing;

-- Транзакции
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  kind text not null check (kind in ('expense', 'income')),
  amount numeric(14, 2) not null check (amount > 0),
  occurred_on date not null default current_date,
  comment text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists transactions_occurred_on_idx on public.transactions (user_id, occurred_on);

alter table public.transactions enable row level security;

create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Регулярные обязательные траты (аренда, действующая ипотека и т.д.)
create table if not exists public.recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  amount numeric(14, 2) not null check (amount > 0),
  starts_on date not null default current_date,
  ends_on date,
  created_at timestamptz not null default now()
);

create index if not exists recurring_expenses_user_id_idx on public.recurring_expenses (user_id);

alter table public.recurring_expenses enable row level security;

create policy "recurring_expenses_all_own"
  on public.recurring_expenses for all
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Запланированные будущие изменения (рост дохода, новая регулярная трата, кредит/ипотека)
create table if not exists public.financial_plan_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (event_type in ('income_change', 'recurring_expense', 'loan')),
  effective_from date not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists financial_plan_events_user_id_idx on public.financial_plan_events (user_id);

alter table public.financial_plan_events enable row level security;

create policy "financial_plan_events_all_own"
  on public.financial_plan_events for all
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Финансовые цели
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  target_date date,
  goal_type text not null default 'savings' check (goal_type in ('savings', 'down_payment')),
  linked_loan_event_id uuid references public.financial_plan_events(id) on delete set null,
  status text not null default 'active' check (status in ('active', 'achieved', 'archived')),
  created_at timestamptz not null default now()
);

create index if not exists goals_user_id_idx on public.goals (user_id);

alter table public.goals enable row level security;

create policy "goals_all_own"
  on public.goals for all
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Активы (недвижимость, авто, гаджеты)
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  asset_type text not null check (asset_type in ('real_estate', 'car', 'gadget', 'other')),
  name text not null,
  current_value numeric(14, 2) not null check (current_value >= 0),
  metadata jsonb not null default '{}'::jsonb,
  acquired_on date,
  created_at timestamptz not null default now()
);

create index if not exists assets_user_id_idx on public.assets (user_id);

alter table public.assets enable row level security;

create policy "assets_all_own"
  on public.assets for all
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()))
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Триггер обновления streak при добавлении транзакции
create or replace function public.update_streak_on_transaction()
returns trigger as $$
declare
  last_date date;
begin
  select last_active_date into last_date from public.profiles where id = new.user_id;

  if last_date is null or last_date < new.occurred_on then
    if last_date = new.occurred_on - interval '1 day' then
      update public.profiles
        set current_streak = current_streak + 1,
            longest_streak = greatest(longest_streak, current_streak + 1),
            last_active_date = new.occurred_on
        where id = new.user_id;
    elsif last_date is null or last_date < new.occurred_on - interval '1 day' then
      update public.profiles
        set current_streak = 1,
            longest_streak = greatest(longest_streak, 1),
            last_active_date = new.occurred_on
        where id = new.user_id;
    else
      update public.profiles set last_active_date = new.occurred_on where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger transactions_update_streak
  after insert on public.transactions
  for each row execute function public.update_streak_on_transaction();
