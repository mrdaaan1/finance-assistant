-- Finance Assistant: значок Premium за оплату Telegram Stars

alter table public.profiles
  add column if not exists is_premium boolean not null default false;

create table if not exists public.star_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  telegram_payment_charge_id text not null unique,
  amount_stars integer not null,
  created_at timestamptz not null default now()
);

create index if not exists star_payments_user_id_idx on public.star_payments (user_id);

alter table public.star_payments enable row level security;

create policy "star_payments_select_own"
  on public.star_payments for select
  to authenticated
  using (user_id = (select id from public.profiles where auth_user_id = auth.uid()));
