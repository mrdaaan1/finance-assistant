import { NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

// Бесплатные нейроголоса Microsoft Edge — без ключа и лимитов.
const VOICE = process.env.CAT_TTS_VOICE ?? "ru-RU-DmitryNeural";
const MAX_TEXT_LENGTH = 1200;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const { text } = (await request.json()) as { text?: string };
  if (!text?.trim()) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  const tts = new MsEdgeTTS();
  try {
    await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text.trim().slice(0, MAX_TEXT_LENGTH), {
      // Чуть быстрее и выше нейтрального — ближе к бодрому коту.
      rate: "+8%",
      pitch: "+5%",
    });

    const chunks: Buffer[] = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk as Buffer);
    }
    const audio = Buffer.concat(chunks);

    if (audio.length === 0) {
      return NextResponse.json({ error: "empty_audio" }, { status: 502 });
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("tts failed", e);
    // Клиент при не-ok ответе озвучит текст через встроенный speechSynthesis.
    return NextResponse.json({ error: "tts_failed" }, { status: 502 });
  } finally {
    tts.close();
  }
}
