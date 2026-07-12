"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";

function ChessLobbyContent() {
  const { supabase, profile } = useSession();
  const router = useRouter();
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const navigatedRef = useRef(false);

  function cleanupSearch() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    fetch("/api/chess-matchmake", { method: "DELETE" });
  }

  useEffect(() => {
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleFindGame() {
    if (!profile) return;
    setSearching(true);
    setError(null);
    navigatedRef.current = false;

    const res = await fetch("/api/chess-matchmake", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError("Не удалось найти игру. Попробуй ещё раз.");
      setSearching(false);
      return;
    }

    if (data.gameId) {
      navigatedRef.current = true;
      router.push(`/games/chess/${data.gameId}`);
      return;
    }

    function goToGame(gameId: string) {
      if (navigatedRef.current) return;
      navigatedRef.current = true;
      if (channelRef.current) supabase.removeChannel(channelRef.current);
      router.push(`/games/chess/${gameId}`);
    }

    const channel = supabase
      .channel(`chess-lobby-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chess_games",
          filter: `black_player_id=eq.${profile.id}`,
        },
        (payload) => goToGame(payload.new.id as string),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chess_games",
          filter: `white_player_id=eq.${profile.id}`,
        },
        (payload) => goToGame(payload.new.id as string),
      )
      .subscribe();

    channelRef.current = channel;
  }

  function handleCancel() {
    cleanupSearch();
    setSearching(false);
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-md mx-auto w-full items-center justify-center text-center">
      <h1 className="text-xl font-bold">♟️ Шахматы</h1>

      {!searching ? (
        <>
          <p className="text-muted">Играй в реальном времени с другим пользователем</p>
          <button
            onClick={handleFindGame}
            className="rounded-xl bg-accent text-white px-6 py-3 font-semibold"
          >
            Найти игру
          </button>
        </>
      ) : (
        <>
          <div className="animate-spin w-10 h-10 border-4 border-accent border-t-transparent rounded-full" />
          <p className="text-muted">Ищем соперника…</p>
          <button onClick={handleCancel} className="text-muted underline text-sm">
            Отменить поиск
          </button>
        </>
      )}

      {error && <p className="text-red-500 text-sm">{error}</p>}
    </main>
  );
}

export default function ChessLobbyPage() {
  return (
    <AuthGate>
      <ChessLobbyContent />
    </AuthGate>
  );
}
