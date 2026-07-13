import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
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
    .select("id, telegram_id, first_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 404 });
  }

  const { data: transactions } = await supabase
    .from("transactions")
    .select("occurred_on, kind, amount, comment, category:categories(name)")
    .eq("user_id", profile.id)
    .order("occurred_on", { ascending: true });

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Транзакции");

  sheet.columns = [
    { header: "Дата", key: "date", width: 14 },
    { header: "Месяц", key: "month", width: 12 },
    { header: "Тип", key: "kind", width: 12 },
    { header: "Категория", key: "category", width: 20 },
    { header: "Сумма, ₽", key: "amount", width: 14 },
    { header: "Комментарий", key: "comment", width: 30 },
  ];
  sheet.getRow(1).font = { bold: true };

  type Row = {
    occurred_on: string;
    kind: "expense" | "income" | "saving";
    amount: number;
    comment: string | null;
    category: { name: string } | { name: string }[] | null;
  };

  const KIND_LABELS: Record<Row["kind"], string> = {
    expense: "Расход",
    income: "Доход",
    saving: "Накопление",
  };

  for (const tx of (transactions ?? []) as Row[]) {
    const categoryName = Array.isArray(tx.category)
      ? tx.category[0]?.name
      : tx.category?.name;

    sheet.addRow({
      date: tx.occurred_on,
      month: new Date(tx.occurred_on).toLocaleDateString("ru-RU", {
        month: "long",
        year: "numeric",
      }),
      kind: KIND_LABELS[tx.kind],
      category: categoryName ?? "Без категории",
      amount: tx.amount,
      comment: tx.comment ?? "",
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const formData = new FormData();
  formData.append("chat_id", String(profile.telegram_id));
  formData.append(
    "document",
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `finance-report-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  formData.append("caption", "Твой финансовый отчёт 📊");

  const telegramRes = await fetch(
    `https://api.telegram.org/bot${botToken}/sendDocument`,
    { method: "POST", body: formData },
  );

  if (!telegramRes.ok) {
    const errorBody = await telegramRes.text();
    console.error("telegram sendDocument failed", errorBody);
    return NextResponse.json({ error: "telegram_send_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
