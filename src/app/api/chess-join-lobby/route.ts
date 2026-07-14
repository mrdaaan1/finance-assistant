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

  const { lobbyId } = (await request.json()) as { lobbyId?: string };
  if (!lobbyId) {
    return NextResponse.json({ error: "invalid_lobby" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("chess_join_lobby", { p_lobby_id: lobbyId });

  if (error) {
    const code = error.message.includes("lobby_not_found")
      ? "lobby_not_found"
      : error.message.includes("cannot_join_own_lobby")
        ? "cannot_join_own_lobby"
        : "join_failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  return NextResponse.json({ gameId: data as string });
}
