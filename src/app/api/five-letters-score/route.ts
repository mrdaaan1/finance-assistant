import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MAX_ATTEMPTS } from "@/lib/games/five-letters";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { won, attempts } = (await request.json()) as { won?: boolean; attempts?: number };
  if (typeof won !== "boolean" || !Number.isInteger(attempts) || attempts! < 1 || attempts! > MAX_ATTEMPTS) {
    return NextResponse.json({ error: "invalid_result" }, { status: 400 });
  }

  const { data, error: rpcError } = await supabase
    .rpc("submit_five_letters_result", { p_won: won, p_attempts: attempts })
    .single();

  if (rpcError) {
    return NextResponse.json({ error: "submit_failed" }, { status: 500 });
  }

  return NextResponse.json(
    data as { current_streak: number; best_streak: number; wins: number }
  );
}
