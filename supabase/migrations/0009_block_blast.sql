-- Finance Assistant: игра "Блок-пазл" (аналог Block Blast) — рекорды очков

create table if not exists public.block_blast_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

create index if not exists block_blast_scores_user_id_idx on public.block_blast_scores (user_id);
create index if not exists block_blast_scores_score_idx on public.block_blast_scores (score desc);

alter table public.block_blast_scores enable row level security;

create policy "block_blast_scores_select_all"
  on public.block_blast_scores for select
  to authenticated
  using (true);

create policy "block_blast_scores_insert_own"
  on public.block_blast_scores for insert
  to authenticated
  with check (user_id = (select id from public.profiles where auth_user_id = auth.uid()));

-- Личный рекорд хранится и в profiles — чтобы не гонять агрегацию по всей
-- истории партий на каждый показ дашборда/списка игр.
alter table public.profiles
  add column if not exists block_blast_best_score integer not null default 0;

create or replace function public.submit_block_blast_score(p_score integer)
returns integer as $$
declare
  v_user_id uuid;
  v_best integer;
begin
  select id, block_blast_best_score into v_user_id, v_best
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_user_id is null then
    raise exception 'profile_not_found';
  end if;

  insert into public.block_blast_scores (user_id, score) values (v_user_id, p_score);

  if p_score > v_best then
    update public.profiles set block_blast_best_score = p_score where id = v_user_id;
    v_best := p_score;
  end if;

  return v_best;
end;
$$ language plpgsql security definer;
