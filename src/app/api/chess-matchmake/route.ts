import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const { data, error } = await supabase.rpc("chess_matchmake", {
    requesting_user_id: profile.id,
  });

  if (error) {
    return NextResponse.json({ error: "matchmake_failed" }, { status: 500 });
  }

  const gameId = data?.[0]?.game_id ?? null;
  return NextResponse.json({ gameId });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (profile) {
    await supabase.from("chess_queue").delete().eq("user_id", profile.id);
  }

  return NextResponse.json({ ok: true });
}
