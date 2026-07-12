"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { CatMascot, type CatState } from "@/components/CatMascot";
import { useSession } from "@/lib/finance/session-context";
import { WavRecorder } from "@/lib/voice/wav-recorder";

type ChatMessage = { role: "user" | "assistant"; content: string };

type FlowState = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

// Пустой WAV для «разблокировки» аудио на iOS: play() внутри жеста
// позволяет потом программно проигрывать ответы в том же элементе.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=";

const GREETING =
  "Мур! Я Финик, твой финансовый кот. Спроси меня про свои траты, цели или попроси совет — можно голосом, зажимать ничего не нужно: нажми на микрофон, скажи и нажми ещё раз.";

function flowToCatState(state: FlowState): CatState {
  if (state === "recording") return "listening";
  if (state === "transcribing" || state === "thinking") return "thinking";
  if (state === "speaking") return "talking";
  return "idle";
}

const STATUS_LABELS: Record<FlowState, string> = {
  idle: "Нажми на микрофон и говори",
  recording: "Слушаю… нажми ещё раз, чтобы отправить",
  transcribing: "Разбираю, что ты сказал…",
  thinking: "Финик думает…",
  speaking: "Финик отвечает…",
};

function CatChatContent() {
  const { profile } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [flow, setFlow] = useState<FlowState>("idle");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);

  const recorderRef = useRef<WavRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef(flow);
  flowRef.current = flow;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, flow]);

  useEffect(() => {
    return () => {
      recorderRef.current?.cancel();
      audioRef.current?.pause();
    };
  }, []);

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    const audio = new Audio(SILENT_WAV);
    audioRef.current = audio;
    audio.play().catch(() => {});
    audioUnlockedRef.current = true;
  }

  function stopSpeaking() {
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
    setFlow("idle");
  }

  const speak = useCallback(async (text: string) => {
    setFlow("speaking");
    try {
      const res = await fetch("/api/cat/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("tts_failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = audioRef.current ?? new Audio();
      audioRef.current = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        audio.onpause = () => resolve();
        audio.src = url;
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
    } catch {
      // Запасной вариант: встроенный синтез речи браузера.
      await new Promise<void>((resolve) => {
        const synth = window.speechSynthesis;
        if (!synth) return resolve();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ru-RU";
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        synth.speak(utterance);
      });
    } finally {
      // Не сбрасываем состояние, если пользователь уже начал новую запись.
      if (flowRef.current === "speaking") setFlow("idle");
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setError(null);

      const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(nextMessages);
      setFlow("thinking");

      try {
        const res = await fetch("/api/cat/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
        });
        if (!res.ok) throw new Error("chat_failed");
        const { reply } = (await res.json()) as { reply: string };

        setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        if (voiceOn) {
          await speak(reply);
        } else {
          setFlow("idle");
        }
      } catch {
        setError("Финик не смог ответить. Проверь соединение и попробуй ещё раз.");
        setFlow("idle");
      }
    },
    [messages, voiceOn, speak],
  );

  async function handleMicTap() {
    unlockAudio();

    if (flow === "speaking") {
      stopSpeaking();
      return;
    }

    if (flow === "recording") {
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (!recorder) return;

      setFlow("transcribing");
      try {
        const wav = await recorder.stop();
        const base64 = await blobToBase64(wav);
        const res = await fetch("/api/cat/transcribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audio: base64 }),
        });
        if (res.status === 422) {
          setError("Не расслышал, мяу. Попробуй сказать ещё раз.");
          setFlow("idle");
          return;
        }
        if (!res.ok) throw new Error("transcribe_failed");
        const { text } = (await res.json()) as { text: string };
        await sendMessage(text);
      } catch {
        setError("Не получилось распознать голос. Попробуй ещё раз или напиши текстом.");
        setFlow("idle");
      }
      return;
    }

    if (flow !== "idle") return;

    setError(null);
    const recorder = new WavRecorder();
    try {
      await recorder.start();
      recorderRef.current = recorder;
      setFlow("recording");
    } catch {
      setError("Нет доступа к микрофону. Разреши его в настройках Telegram и попробуй снова.");
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (flow === "thinking" || flow === "transcribing") return;
    unlockAudio();
    if (flow === "speaking") stopSpeaking();
    const text = input;
    setInput("");
    sendMessage(text);
  }

  const busy = flow === "transcribing" || flow === "thinking";

  return (
    <main className="flex-1 flex flex-col max-w-md mx-auto w-full">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur px-4 pt-4 pb-3 flex flex-col items-center border-b border-card-border">
        <div className="flex w-full items-start justify-between">
          <Link
            href="/"
            aria-label="Назад на дашборд"
            className="w-10 h-10 rounded-full bg-card border border-card-border flex items-center justify-center text-lg text-muted active:scale-95 transition-transform"
          >
            ←
          </Link>
          <CatMascot mood="happy" state={flowToCatState(flow)} size={120} interactive={flow === "idle"} />
          <button
            onClick={() => {
              if (flow === "speaking") stopSpeaking();
              setVoiceOn((v) => !v);
            }}
            className="w-10 h-10 rounded-full bg-card border border-card-border text-lg"
            title={voiceOn ? "Выключить озвучку" : "Включить озвучку"}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
        </div>
        <p className="font-bold mt-1">Финик</p>
        <p className="text-muted text-xs">{STATUS_LABELS[flow]}</p>
      </div>

      <div className="flex-1 flex flex-col gap-3 px-4 py-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
              m.role === "user"
                ? "self-end bg-accent text-white rounded-br-md"
                : "self-start bg-card border border-card-border rounded-bl-md"
            }`}
          >
            {m.content}
          </div>
        ))}

        {busy && (
          <div className="self-start bg-card border border-card-border rounded-2xl rounded-bl-md px-4 py-3">
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-muted animate-bounce [animation-delay:300ms]" />
            </span>
          </div>
        )}

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-4 flex flex-col items-center gap-3">
        <button
          onClick={handleMicTap}
          disabled={busy}
          aria-label={flow === "recording" ? "Отправить запись" : "Записать голосовое"}
          className={`w-20 h-20 rounded-full text-3xl shadow-lg transition-all disabled:opacity-40 ${
            flow === "recording"
              ? "bg-red-500 text-white scale-110 animate-pulse"
              : flow === "speaking"
                ? "bg-card border-2 border-accent"
                : "bg-gradient-to-br from-accent to-accent-dark text-white active:scale-95"
          }`}
        >
          {flow === "recording" ? "⏹" : flow === "speaking" ? "⏸" : "🎤"}
        </button>

        <form onSubmit={handleSubmit} className="w-full flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Или напиши текстом…"
            className="flex-1 rounded-xl bg-card border border-card-border px-4 py-3 text-sm outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-accent text-white px-4 font-semibold disabled:opacity-40"
          >
            ➤
          </button>
        </form>
      </div>
    </main>
  );
}

async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve(dataUrl.slice(dataUrl.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export default function CatChatPage() {
  return (
    <AuthGate>
      <CatChatContent />
    </AuthGate>
  );
}
