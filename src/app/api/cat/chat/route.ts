import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter, CHAT_MODEL, type ChatMessage } from "@/lib/openrouter";

export const maxDuration = 30;

const MAX_HISTORY = 20;

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

type IncomingMessage = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { messages } = (await request.json()) as { messages?: IncomingMessage[] };
  if (!messages?.length) {
    return NextResponse.json({ error: "messages_required" }, { status: 400 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, first_name, current_streak, longest_streak, is_premium")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().slice(0, 10);

  const [{ data: monthTxs }, { data: goals }, { data: assets }, { data: recurring }, { data: incomeEvents }] =
    await Promise.all([
      supabase
        .from("transactions")
        .select("kind, amount, occurred_on, comment, category:categories(name)")
        .eq("user_id", profile.id)
        .gte("occurred_on", monthStartStr)
        .order("occurred_on", { ascending: false })
        .limit(100),
      supabase
        .from("goals")
        .select("name, target_amount, target_date, monthly_contribution, status")
        .eq("user_id", profile.id)
        .eq("status", "active"),
      supabase
        .from("assets")
        .select("name, asset_type, current_value")
        .eq("user_id", profile.id),
      supabase
        .from("recurring_expenses")
        .select("name, amount, duration_months")
        .eq("user_id", profile.id)
        .eq("is_active", true),
      supabase
        .from("financial_plan_events")
        .select("payload, effective_from")
        .eq("user_id", profile.id)
        .eq("event_type", "income_change")
        .order("effective_from", { ascending: false })
        .limit(1),
    ]);

  type TxRow = {
    kind: "expense" | "income" | "saving";
    amount: number;
    occurred_on: string;
    comment: string | null;
    category: { name: string } | { name: string }[] | null;
  };

  const txs = (monthTxs ?? []) as TxRow[];
  const totals = { expense: 0, income: 0, saving: 0 };
  const byCategory = new Map<string, number>();
  for (const tx of txs) {
    totals[tx.kind] += tx.amount;
    if (tx.kind === "expense") {
      const name = (Array.isArray(tx.category) ? tx.category[0]?.name : tx.category?.name) ?? "Без категории";
      byCategory.set(name, (byCategory.get(name) ?? 0) + tx.amount);
    }
  }
  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, amount]) => `${name}: ${formatMoney(amount)} ₽`)
    .join(", ");

  const plannedIncome =
    (incomeEvents?.[0]?.payload as { new_monthly_income?: number } | undefined)?.new_monthly_income ?? 0;

  const lastTxLines = txs
    .slice(0, 10)
    .map((tx) => {
      const kindLabel = tx.kind === "expense" ? "расход" : tx.kind === "income" ? "доход" : "отложено";
      const cat = (Array.isArray(tx.category) ? tx.category[0]?.name : tx.category?.name) ?? "";
      return `  ${tx.occurred_on}: ${kindLabel} ${formatMoney(tx.amount)} ₽${cat ? ` (${cat})` : ""}${tx.comment ? ` — ${tx.comment}` : ""}`;
    })
    .join("\n");

  const goalLines = (goals ?? [])
    .map(
      (g) =>
        `  ${g.name}: цель ${formatMoney(g.target_amount)} ₽, взнос ${formatMoney(g.monthly_contribution)} ₽/мес${g.target_date ? `, срок ${g.target_date}` : ""}`,
    )
    .join("\n");

  const assetLines = (assets ?? [])
    .map((a) => `  ${a.name}: ${formatMoney(a.current_value)} ₽`)
    .join("\n");

  const recurringLines = (recurring ?? [])
    .map((r) => `  ${r.name}: ${formatMoney(r.amount)} ₽/мес${r.duration_months ? ` (ещё ${r.duration_months} мес)` : ""}`)
    .join("\n");

  const userName = profile.display_name ?? profile.first_name;
  const today = new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });

  const systemPrompt = `Ты — Финик, чёрный кот и финансовый наставник в приложении «Финансовый помощник». Ты общаешься с пользователем по имени ${userName}.

Твой характер: дружелюбный, тёплый, слегка игривый кот, но при этом толковый финансовый консультант. Иногда (не в каждом сообщении!) вставляешь лёгкие кошачьи нотки: «мур», «мяу», упоминания про сметану или клубок. Никогда не выходишь из роли.

ОЧЕНЬ ВАЖНО — формат ответа:
- Твой ответ будет озвучен голосом, поэтому пиши разговорно и коротко: 2–4 предложения, максимум 5.
- Никакого markdown, списков, заголовков, эмодзи и спецсимволов — только чистый текст.
- Числа пиши так, чтобы их было естественно прочитать вслух.
- Отвечай только по-русски.

Ты помогаешь с личными финансами: анализируешь траты, помогаешь ставить цели, подбадриваешь копить, отвечаешь на вопросы о бюджете. Если спрашивают не про финансы — можешь коротко ответить, но мягко возвращай разговор к деньгам и целям.

Сегодня ${today}. Реальные данные пользователя (используй их в ответах, когда уместно):
- Серия дней с записью операций (streak): ${profile.current_streak} (рекорд ${profile.longest_streak})
- Плановый месячный доход: ${plannedIncome ? `${formatMoney(plannedIncome)} ₽` : "не указан"}
- За текущий месяц: доходы ${formatMoney(totals.income)} ₽, расходы ${formatMoney(totals.expense)} ₽, отложено ${formatMoney(totals.saving)} ₽
- Топ категорий трат за месяц: ${topCategories || "трат ещё нет"}
- Последние операции:
${lastTxLines || "  пока нет"}
- Активные цели накопления:
${goalLines || "  целей пока нет — предложи завести"}
- Регулярные ежемесячные траты:
${recurringLines || "  не указаны"}
- Активы:
${assetLines || "  не указаны"}`;

  const history: ChatMessage[] = messages.slice(-MAX_HISTORY).map((m) => ({
    role: m.role,
    content: String(m.content).slice(0, 2000),
  }));

  try {
    const reply = await callOpenRouter(CHAT_MODEL, [
      { role: "system", content: systemPrompt },
      ...history,
    ]);
    return NextResponse.json({ reply });
  } catch (e) {
    console.error("cat chat failed", e);
    return NextResponse.json({ error: "chat_failed" }, { status: 502 });
  }
}
