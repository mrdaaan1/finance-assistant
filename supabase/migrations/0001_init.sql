-- Finance Assistant MVP: пользователи Telegram Mini App (лидерборд/список участников)

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null unique,
  username text,
  first_name text not null,
  last_name text,
  avatar_url text,
  auth_user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_telegram_id_idx on public.profiles (telegram_id);
create index if not exists profiles_created_at_idx on public.profiles (created_at);

alter table public.profiles enable row level security;

-- Любой авторизованный пользователь видит всех (лидерборд = список всех участников)
create policy "profiles_select_all_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- Пользователь может обновлять/вставлять только свою запись
-- (на практике upsert при логине идёт через service_role в Route Handler и обходит RLS)
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth_user_id = auth.uid());

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ЗАДЕЛ НА БУДУЩЕЕ (не создавать сейчас, только для справки):
--   transactions  (доходы/расходы пользователя)
--   categories    (категории трат: еда, транспорт, жильё и т.д.)
--   budgets       (лимиты по категориям/периодам)
