import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const BET_AMOUNT = 1000;
const WIN_MULTIPLIER = 10;
const SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "7️⃣"];

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const reels = [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  const isWin = reels[0] === reels[1] && reels[1] === reels[2];

  // RPC делает SELECT ... FOR UPDATE + запись спина одной транзакцией —
  // защищает от гонки при параллельных/повторных запросах (см. миграцию
  // 0008_slot_spin_atomic.sql).
  const { data, error: rpcError } = await supabase
    .rpc("slot_spin", {
      p_bet_amount: BET_AMOUNT,
      p_win_multiplier: WIN_MULTIPLIER,
      p_reels: reels,
      p_is_win: isWin,
    })
    .single();

  if (rpcError) {
    if (rpcError.message.includes("insufficient_balance")) {
      return NextResponse.json({ error: "insufficient_balance" }, { status: 400 });
    }
    if (rpcError.message.includes("profile_not_found")) {
      return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
    }
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  const { new_balance: newBalance, payout } = data as { new_balance: number; payout: number };

  return NextResponse.json({ reels, isWin, payout, newBalance, betAmount: BET_AMOUNT });
}
