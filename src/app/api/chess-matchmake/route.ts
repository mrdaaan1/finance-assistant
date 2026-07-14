import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getProfileId(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  return profile?.id ?? null;
}

export async function POST() {
  const supabase = await createClient();
  const profileId = await getProfileId(supabase);
  if (!profileId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("chess_create_lobby");

  if (error) {
    const code = error.message.includes("already_in_game") ? "already_in_game" : "create_lobby_failed";
    return NextResponse.json({ error: code }, { status: 400 });
  }

  return NextResponse.json({ lobbyId: data as string });
}

export async function DELETE() {
  const supabase = await createClient();
  const profileId = await getProfileId(supabase);
  if (!profileId) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  await supabase.rpc("chess_cancel_lobby");

  return NextResponse.json({ ok: true });
}
