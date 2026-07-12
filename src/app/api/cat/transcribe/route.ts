import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callOpenRouter, STT_MODEL } from "@/lib/openrouter";

export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { audio } = (await request.json()) as { audio?: string };
  if (!audio) {
    return NextResponse.json({ error: "audio_required" }, { status: 400 });
  }

  try {
    const text = await callOpenRouter(STT_MODEL, [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Расшифруй эту голосовую запись на русском языке. Верни только сам текст сказанного, без кавычек, пояснений и комментариев. Если запись пустая или неразборчивая, верни ровно строку: [неразборчиво]",
          },
          { type: "input_audio", input_audio: { data: audio, format: "wav" } },
        ],
      },
    ]);

    if (text === "[неразборчиво]") {
      return NextResponse.json({ error: "unintelligible" }, { status: 422 });
    }

    return NextResponse.json({ text });
  } catch (e) {
    console.error("transcribe failed", e);
    return NextResponse.json({ error: "transcribe_failed" }, { status: 502 });
  }
}
