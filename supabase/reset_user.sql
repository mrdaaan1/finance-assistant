-- Обнуляет прогресс пользователя: онбординг, streak, все транзакции/цели/активы/план.
-- Не является миграцией — запускать вручную по необходимости в Supabase SQL Editor.
--
-- Использование: замени telegram_id ниже на нужный и выполни весь скрипт.

do $$
declare
  target_telegram_id bigint := 763603322; -- <-- поменяй на свой telegram_id
  target_user_id uuid;
begin
  select id into target_user_id
  from public.profiles
  where telegram_id = target_telegram_id;

  if target_user_id is null then
    raise notice 'Профиль с telegram_id % не найден', target_telegram_id;
    return;
  end if;

  delete from public.transactions where user_id = target_user_id;
  delete from public.goals where user_id = target_user_id;
  delete from public.assets where user_id = target_user_id;
  delete from public.recurring_expenses where user_id = target_user_id;
  delete from public.financial_plan_events where user_id = target_user_id;

  update public.profiles
  set current_streak = 0,
      longest_streak = 0,
      last_active_date = null,
      onboarded = false,
      display_name = null,
      avatar_key = null
  where id = target_user_id;

  raise notice 'Профиль % (telegram_id %) обнулён', target_user_id, target_telegram_id;
end $$;
