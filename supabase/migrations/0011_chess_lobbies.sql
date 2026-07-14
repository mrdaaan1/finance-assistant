-- Finance Assistant: именованные шахматные лобби вместо анонимной очереди
-- случайного matchmaking — игрок создаёт открытое лобби, другие видят
-- список и присоединяются к конкретному человеку. Плюс возможность сдаться
-- и выйти из активной партии.

drop function if exists public.chess_matchmake(uuid);

alter table public.chess_games
  add column if not exists ended_by_id uuid references public.profiles(id) on delete set null;

alter table public.chess_games
  drop constraint if exists chess_games_status_check;

alter table public.chess_games
  add constraint chess_games_status_check check (status in ('active', 'finished', 'abandoned'));

create table if not exists public.chess_lobbies (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create unique index if not exists chess_lobbies_host_idx on public.chess_lobbies (host_id);

alter table public.chess_lobbies enable row level security;

create policy "chess_lobbies_select_all"
  on public.chess_lobbies for select
  to authenticated
  using (true);

create policy "chess_lobbies_insert_own"
  on public.chess_lobbies for insert
  to authenticated
  with check (host_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "chess_lobbies_delete_own"
  on public.chess_lobbies for delete
  to authenticated
  using (host_id = (select id from public.profiles where auth_user_id = auth.uid()));

alter publication supabase_realtime add table public.chess_lobbies;

-- Создаёт лобби для текущего пользователя (или возвращает уже существующее,
-- если он уже кого-то ждёт). Если у игрока уже есть активная партия —
-- ошибка, сначала нужно её покинуть.
create or replace function public.chess_create_lobby()
returns uuid as $$
declare
  v_user_id uuid;
  v_lobby_id uuid;
  v_active_game uuid;
begin
  select id into v_user_id from public.profiles where auth_user_id = auth.uid();
  if v_user_id is null then
    raise exception 'profile_not_found';
  end if;

  select id into v_active_game
  from public.chess_games
  where status = 'active'
    and (white_player_id = v_user_id or black_player_id = v_user_id)
  limit 1;

  if v_active_game is not null then
    raise exception 'already_in_game';
  end if;

  insert into public.chess_lobbies (host_id)
  values (v_user_id)
  on conflict (host_id) do update set created_at = public.chess_lobbies.created_at
  returning id into v_lobby_id;

  return v_lobby_id;
end;
$$ language plpgsql security definer;

create or replace function public.chess_cancel_lobby()
returns void as $$
declare
  v_user_id uuid;
begin
  select id into v_user_id from public.profiles where auth_user_id = auth.uid();
  if v_user_id is null then
    return;
  end if;

  delete from public.chess_lobbies where host_id = v_user_id;
end;
$$ language plpgsql security definer;

-- Присоединяет текущего пользователя к чужому лобби, атомарно создавая
-- партию и удаляя лобби. FOR UPDATE SKIP LOCKED защищает от гонки, если
-- к одному лобби пытаются присоединиться одновременно двое.
create or replace function public.chess_join_lobby(p_lobby_id uuid)
returns uuid as $$
declare
  v_user_id uuid;
  v_host_id uuid;
  v_game_id uuid;
begin
  select id into v_user_id from public.profiles where auth_user_id = auth.uid();
  if v_user_id is null then
    raise exception 'profile_not_found';
  end if;

  select host_id into v_host_id
  from public.chess_lobbies
  where id = p_lobby_id
  for update skip locked;

  if v_host_id is null then
    raise exception 'lobby_not_found';
  end if;

  if v_host_id = v_user_id then
    raise exception 'cannot_join_own_lobby';
  end if;

  delete from public.chess_lobbies where id = p_lobby_id;

  insert into public.chess_games (white_player_id, black_player_id)
  values (v_host_id, v_user_id)
  returning id into v_game_id;

  return v_game_id;
end;
$$ language plpgsql security definer;

-- Сдача/выход из активной партии: помечает игру завершённой, победа
-- присуждается сопернику. Работает как для "сдался", так и для "вышел".
create or replace function public.chess_resign(p_game_id uuid)
returns void as $$
declare
  v_user_id uuid;
  v_white uuid;
  v_black uuid;
  v_status text;
begin
  select id into v_user_id from public.profiles where auth_user_id = auth.uid();
  if v_user_id is null then
    raise exception 'profile_not_found';
  end if;

  select white_player_id, black_player_id, status
    into v_white, v_black, v_status
  from public.chess_games
  where id = p_game_id
  for update;

  if v_white is null then
    raise exception 'game_not_found';
  end if;

  if v_user_id <> v_white and v_user_id <> v_black then
    raise exception 'not_a_participant';
  end if;

  if v_status <> 'active' then
    return;
  end if;

  update public.chess_games
  set status = 'abandoned',
      winner_id = case when v_user_id = v_white then v_black else v_white end,
      ended_by_id = v_user_id,
      last_move_at = now()
  where id = p_game_id;
end;
$$ language plpgsql security definer;
