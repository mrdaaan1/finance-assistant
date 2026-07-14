import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { gameId } = (await request.json()) as { gameId?: string };
  if (!gameId) {
    return NextResponse.json({ error: "invalid_game" }, { status: 400 });
  }

  const { error } = await supabase.rpc("chess_resign", { p_game_id: gameId });

  if (error) {
    return NextResponse.json({ error: "resign_failed" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
