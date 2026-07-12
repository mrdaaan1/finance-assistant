-- Finance Assistant: онлайн-шахматы с matchmaking через очередь ожидания

create table if not exists public.chess_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.chess_queue enable row level security;

create policy "chess_queue_select_all"
  on public.chess_queue for select
  to authenticated
  using (true);

create policy "chess_queue_insert_own"
  on public.chess_queue for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create policy "chess_queue_delete_own"
  on public.chess_queue for delete
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

create table if not exists public.chess_games (
  id uuid primary key default gen_random_uuid(),
  white_player_id uuid not null references public.profiles(id) on delete cascade,
  black_player_id uuid not null references public.profiles(id) on delete cascade,
  fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn text not null default '',
  status text not null default 'active' check (status in ('active', 'finished')),
  winner_id uuid references public.profiles(id) on delete set null,
  last_move_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists chess_games_white_idx on public.chess_games (white_player_id);
create index if not exists chess_games_black_idx on public.chess_games (black_player_id);

alter table public.chess_games enable row level security;

create policy "chess_games_select_participant"
  on public.chess_games for select
  to authenticated
  using (
    white_player_id = (select id from public.profiles where auth_user_id = auth.uid())
    or black_player_id = (select id from public.profiles where auth_user_id = auth.uid())
  );

create policy "chess_games_insert_participant"
  on public.chess_games for insert
  to authenticated
  with check (
    white_player_id = (select id from public.profiles where auth_user_id = auth.uid())
    or black_player_id = (select id from public.profiles where auth_user_id = auth.uid())
  );

create policy "chess_games_update_participant"
  on public.chess_games for update
  to authenticated
  using (
    white_player_id = (select id from public.profiles where auth_user_id = auth.uid())
    or black_player_id = (select id from public.profiles where auth_user_id = auth.uid())
  );

alter publication supabase_realtime add table public.chess_games;

-- Атомарный matchmaking: пытаемся найти другого ожидающего игрока и сразу
-- создать партию, либо встаём в очередь сами. security definer + FOR UPDATE
-- SKIP LOCKED защищают от гонки при одновременных вызовах.
create or replace function public.chess_matchmake(requesting_user_id uuid)
returns table (game_id uuid) as $$
declare
  opponent_id uuid;
  new_game_id uuid;
begin
  -- Уже есть активная партия? Возвращаем её.
  select id into new_game_id
  from public.chess_games
  where status = 'active'
    and (white_player_id = requesting_user_id or black_player_id = requesting_user_id)
  limit 1;

  if new_game_id is not null then
    return query select new_game_id;
    return;
  end if;

  -- Ищем любого другого игрока в очереди (кроме себя), блокируем строку.
  select user_id into opponent_id
  from public.chess_queue
  where user_id <> requesting_user_id
  order by created_at
  limit 1
  for update skip locked;

  if opponent_id is not null then
    delete from public.chess_queue where user_id in (opponent_id, requesting_user_id);

    insert into public.chess_games (white_player_id, black_player_id)
    values (requesting_user_id, opponent_id)
    returning id into new_game_id;

    return query select new_game_id;
    return;
  end if;

  -- Соперника нет — встаём в очередь сами.
  insert into public.chess_queue (user_id)
  values (requesting_user_id)
  on conflict (user_id) do nothing;

  return query select null::uuid;
end;
$$ language plpgsql security definer;
