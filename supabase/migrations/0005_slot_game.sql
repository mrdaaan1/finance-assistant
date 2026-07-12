-- Finance Assistant: игровой раздел (слот-автомат на виртуальные деньги)

alter table public.profiles
  add column if not exists game_balance numeric(14, 2) not null default 100000;

create table if not exists public.slot_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bet_amount numeric(14, 2) not null,
  payout_amount numeric(14, 2) not null default 0,
  reels text[] not null,
  is_win boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists slot_spins_user_id_idx on public.slot_spins (user_id);

alter table public.slot_spins enable row level security;

create policy "slot_spins_select_own"
  on public.slot_spins for select
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "slot_spins_insert_own"
  on public.slot_spins for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Продлеваем существующий триггер streak: первая транзакция за день
-- также начисляет +10 000 к игровому балансу.
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
            last_active_date = new.occurred_on,
            game_balance = game_balance + 10000
        where id = new.user_id;
    elsif last_date is null or last_date < new.occurred_on - interval '1 day' then
      update public.profiles
        set current_streak = 1,
            longest_streak = greatest(longest_streak, 1),
            last_active_date = new.occurred_on,
            game_balance = game_balance + 10000
        where id = new.user_id;
    else
      update public.profiles
        set last_active_date = new.occurred_on,
            game_balance = game_balance + 10000
        where id = new.user_id;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer;
