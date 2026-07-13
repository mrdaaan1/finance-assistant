-- Finance Assistant: ачивки и валюта "Бусты"

alter table public.profiles
  add column if not exists boosts_balance integer not null default 0;

-- Журнал начисленных ачивок: одна запись на пару (user_id, achievement_key),
-- защищает от повторного начисления бустов за одно и то же достижение.
create table if not exists public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  achievement_key text not null,
  boosts_awarded integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, achievement_key)
);

create index if not exists achievements_user_id_idx on public.achievements (user_id);

alter table public.achievements enable row level security;

create policy "achievements_select_own"
  on public.achievements for select
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "achievements_insert_own"
  on public.achievements for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Атомарно начисляет ачивку и бусты: если уже начислена — просто возвращает
-- false, чтобы клиент не показывал повторную анимацию и не дублировал баланс.
create or replace function public.grant_achievement(
  p_achievement_key text,
  p_boosts integer
)
returns boolean as $$
declare
  v_user_id uuid;
  v_new_id uuid;
begin
  select id into v_user_id from public.profiles where auth_user_id = auth.uid();
  if v_user_id is null then
    return false;
  end if;

  insert into public.achievements (user_id, achievement_key, boosts_awarded)
  values (v_user_id, p_achievement_key, p_boosts)
  on conflict (user_id, achievement_key) do nothing
  returning id into v_new_id;

  if v_new_id is not null then
    update public.profiles set boosts_balance = boosts_balance + p_boosts where id = v_user_id;
    return true;
  end if;

  return false;
end;
$$ language plpgsql security definer;
