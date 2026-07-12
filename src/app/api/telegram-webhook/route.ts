import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/finance/admin";

type TelegramUpdate = {
  pre_checkout_query?: {
    id: string;
    invoice_payload: string;
  };
  message?: {
    successful_payment?: {
      telegram_payment_charge_id: string;
      total_amount: number;
      invoice_payload: string;
    };
  };
};

async function callTelegram(method: string, body: unknown) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function POST(request: Request) {
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const update: TelegramUpdate = await request.json();

  if (update.pre_checkout_query) {
    await callTelegram("answerPreCheckoutQuery", {
      pre_checkout_query_id: update.pre_checkout_query.id,
      ok: true,
    });
    return NextResponse.json({ ok: true });
  }

  const payment = update.message?.successful_payment;
  if (payment) {
    const [, userId] = payment.invoice_payload.split(":");
    const admin = createAdminClient();

    await admin.from("star_payments").insert({
      user_id: userId,
      telegram_payment_charge_id: payment.telegram_payment_charge_id,
      amount_stars: payment.total_amount,
    });

    await admin.from("profiles").update({ is_premium: true }).eq("id", userId);
  }

  return NextResponse.json({ ok: true });
}
