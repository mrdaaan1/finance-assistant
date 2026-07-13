-- Finance Assistant: атомарный спин слота, чтобы исключить гонку при
-- одновременных/повторных запросах (двойной клик, плохая сеть — клиент
-- повторяет запрос, не дождавшись ответа).
--
-- Раньше баланс читался в JS, затем обновлялся отдельным UPDATE — если два
-- запроса накладывались друг на друга, оба читали один и тот же старый
-- баланс и оба списывали ставку от него: деньги могли пропадать или
-- задваиваться непредсказуемо. FOR UPDATE лочит строку профиля на время
-- транзакции RPC, второй параллельный вызов дожидается своей очереди и
-- видит уже актуальный баланс.

create or replace function public.slot_spin(
  p_bet_amount numeric,
  p_win_multiplier numeric,
  p_reels text[],
  p_is_win boolean
)
returns table (new_balance numeric, payout numeric) as $$
declare
  v_user_id uuid;
  v_balance numeric;
  v_payout numeric;
begin
  select id, game_balance into v_user_id, v_balance
  from public.profiles
  where auth_user_id = auth.uid()
  for update;

  if v_user_id is null then
    raise exception 'profile_not_found';
  end if;

  if v_balance < p_bet_amount then
    raise exception 'insufficient_balance';
  end if;

  v_payout := case when p_is_win then p_bet_amount * p_win_multiplier else 0 end;
  v_balance := v_balance - p_bet_amount + v_payout;

  update public.profiles set game_balance = v_balance where id = v_user_id;

  insert into public.slot_spins (user_id, bet_amount, payout_amount, reels, is_win)
  values (v_user_id, p_bet_amount, v_payout, p_reels, p_is_win);

  return query select v_balance, v_payout;
end;
$$ language plpgsql security definer;
