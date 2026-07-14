-- Finance Assistant: игра "5 букв" (аналог ежедневной игры Т-Банка) — одна
-- попытка в день на пользователя, отслеживаем серию побед подряд.

create table if not exists public.five_letters_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  play_date date not null,
  won boolean not null,
  attempts integer not null check (attempts >= 1 and attempts <= 6),
  created_at timestamptz not null default now(),
  unique (user_id, play_date)
);

create index if not exists five_letters_results_user_id_idx on public.five_letters_results (user_id);

alter table public.five_letters_results enable row level security;

create policy "five_letters_results_select_own"
  on public.five_letters_results for select
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "five_letters_results_insert_own"
  on public.five_letters_results for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Агрегаты хранятся и в profiles — чтобы не гонять запрос по истории на
-- каждый показ дашборда/списка игр (тот же приём, что в block_blast).
alter table public.profiles
  add column if not exists five_letters_current_streak integer not null default 0,
  add column if not exists five_letters_best_streak integer not null default 0,
  add column if not exists five_letters_wins integer not null default 0,
  add column if not exists five_letters_last_play_date date;

-- Принимает результат одной сегодняшней попытки. Идемпотентна на день:
-- повторный вызов с той же датой (что клиент не должен делать, но сервер
-- обязан гарантировать) не даёт сыграть дважды за счёт unique-констрейнта
-- на (user_id, play_date) — конфликт просто ничего не меняет.
create or replace function public.submit_five_letters_result(p_won boolean, p_attempts integer)
returns table (current_streak integer, best_streak integer, wins integer) as $$
declare
  v_user_id uuid;
  v_current_streak integer;
  v_best_streak integer;
  v_wins integer;
  v_last_play date;
  v_today date := current_date;
  v_inserted boolean;
begin
  select id, five_letters_current_streak, five_letters_best_streak, five_letters_wins, five_letters_last_play_date
    into v_user_id, v_current_streak, v_best_streak, v_wins, v_last_play
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_user_id is null then
    raise exception 'profile_not_found';
  end if;

  insert into public.five_letters_results (user_id, play_date, won, attempts)
  values (v_user_id, v_today, p_won, p_attempts)
  on conflict (user_id, play_date) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return query select v_current_streak, v_best_streak, v_wins;
    return;
  end if;

  if p_won then
    -- Серия продолжается только если вчера тоже была зафиксирована игра
    -- (иначе пропущенный день сбрасывает счётчик).
    if v_last_play = v_today - 1 then
      v_current_streak := v_current_streak + 1;
    else
      v_current_streak := 1;
    end if;
    v_wins := v_wins + 1;
    if v_current_streak > v_best_streak then
      v_best_streak := v_current_streak;
    end if;
  else
    v_current_streak := 0;
  end if;

  update public.profiles
  set five_letters_current_streak = v_current_streak,
      five_letters_best_streak = v_best_streak,
      five_letters_wins = v_wins,
      five_letters_last_play_date = v_today
  where id = v_user_id;

  return query select v_current_streak, v_best_streak, v_wins;
end;
$$ language plpgsql security definer;
