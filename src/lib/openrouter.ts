// Общий клиент OpenRouter для чата с котом и транскрибации голоса.

type ContentPart =
  | { type: "text"; text: string }
  | { type: "input_audio"; input_audio: { data: string; format: "wav" | "mp3" } };

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
};

export const CHAT_MODEL = process.env.OPENROUTER_CHAT_MODEL ?? "google/gemini-2.5-flash";
// Транскрибация — тоже Gemini: мультимодальная модель принимает WAV напрямую,
// отдельный STT-сервис (и отдельный ключ) не нужен.
export const STT_MODEL = process.env.OPENROUTER_STT_MODEL ?? "google/gemini-2.5-flash-lite";

export async function callOpenRouter(model: string, messages: ChatMessage[]): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not set");

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://finance-assistant-hazel.vercel.app",
      "X-Title": "Finance Assistant Cat",
    },
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  const text: string | undefined = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenRouter returned empty response");
  return text.trim();
}
