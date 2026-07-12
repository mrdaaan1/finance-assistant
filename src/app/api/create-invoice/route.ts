import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PREMIUM_PRICE_STARS = 5;

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
    .select("id, telegram_id, is_premium")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;

  const res = await fetch(`https://api.telegram.org/bot${botToken}/createInvoiceLink`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Premium-статус",
      description: "Значок Premium в профиле и рейтинге финансового помощника",
      payload: `premium:${profile.id}`,
      currency: "XTR",
      prices: [{ label: "Premium", amount: PREMIUM_PRICE_STARS }],
    }),
  });

  const data = await res.json();

  if (!data.ok) {
    return NextResponse.json({ error: "invoice_creation_failed" }, { status: 502 });
  }

  return NextResponse.json({ invoiceLink: data.result });
}
