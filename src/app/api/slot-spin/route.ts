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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, game_balance")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  if (profile.game_balance < BET_AMOUNT) {
    return NextResponse.json({ error: "insufficient_balance" }, { status: 400 });
  }

  const reels = [0, 0, 0].map(() => SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]);
  const isWin = reels[0] === reels[1] && reels[1] === reels[2];
  const payout = isWin ? BET_AMOUNT * WIN_MULTIPLIER : 0;
  const newBalance = profile.game_balance - BET_AMOUNT + payout;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ game_balance: newBalance })
    .eq("id", profile.id);

  if (updateError) {
    return NextResponse.json({ error: "update_failed" }, { status: 500 });
  }

  await supabase.from("slot_spins").insert({
    user_id: profile.id,
    bet_amount: BET_AMOUNT,
    payout_amount: payout,
    reels,
    is_win: isWin,
  });

  return NextResponse.json({ reels, isWin, payout, newBalance, betAmount: BET_AMOUNT });
}
