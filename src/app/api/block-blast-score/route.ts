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

  const { score } = (await request.json()) as { score?: number };
  if (typeof score !== "number" || !Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: "invalid_score" }, { status: 400 });
  }

  // Округляем на сервере — очки считаются на клиенте, но по чистой детерминированной
  // формуле (см. src/lib/games/block-blast.ts), подделать не проще, чем в слоте.
  const roundedScore = Math.round(score);

  const { data, error: rpcError } = await supabase
    .rpc("submit_block_blast_score", { p_score: roundedScore })
    .single();

  if (rpcError) {
    return NextResponse.json({ error: "submit_failed" }, { status: 500 });
  }

  return NextResponse.json({ bestScore: data as number });
}
