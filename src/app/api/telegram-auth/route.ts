import { NextResponse } from "next/server";
import { validateTelegramInitData } from "@/lib/finance/telegram";
import { createAdminClient } from "@/lib/finance/admin";

export async function POST(request: Request) {
  const { initData } = await request.json();

  const botToken = process.env.TELEGRAM_BOT_TOKEN!;
  const telegramUser = initData
    ? validateTelegramInitData(initData, botToken)
    : null;

  if (!telegramUser) {
    return NextResponse.json({ error: "invalid_init_data" }, { status: 401 });
  }

  const admin = createAdminClient();
  const email = `tg_${telegramUser.id}@telegram.local`;

  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id, auth_user_id")
    .eq("telegram_id", telegramUser.id)
    .maybeSingle();

  let authUserId = existingProfile?.auth_user_id as string | undefined;

  if (!authUserId) {
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { telegram_id: telegramUser.id },
      });

    if (createError || !created.user) {
      return NextResponse.json({ error: "user_create_failed" }, { status: 500 });
    }

    authUserId = created.user.id;
  }

  const profileFields = {
    telegram_id: telegramUser.id,
    username: telegramUser.username ?? null,
    first_name: telegramUser.first_name,
    last_name: telegramUser.last_name ?? null,
    avatar_url: telegramUser.photo_url ?? null,
    auth_user_id: authUserId,
  };

  const { error: upsertError } = await admin
    .from("profiles")
    .upsert(profileFields, { onConflict: "telegram_id" });

  if (upsertError) {
    return NextResponse.json({ error: "profile_upsert_failed" }, { status: 500 });
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email });

  if (linkError || !linkData) {
    return NextResponse.json({ error: "link_generation_failed" }, { status: 500 });
  }

  const { data: sessionData, error: verifyError } = await admin.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError || !sessionData.session) {
    return NextResponse.json({ error: "session_verify_failed" }, { status: 500 });
  }

  return NextResponse.json({
    access_token: sessionData.session.access_token,
    refresh_token: sessionData.session.refresh_token,
  });
}
