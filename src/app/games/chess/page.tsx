"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";
import { avatarEmoji } from "@/lib/finance/types";

type LobbyRow = {
  id: string;
  host_id: string;
  created_at: string;
  profiles: {
    display_name: string | null;
    first_name: string;
    avatar_key: string | null;
  } | null;
};

function ChessLobbyContent() {
  const { supabase, profile } = useSession();
  const router = useRouter();
  const [lobbies, setLobbies] = useState<LobbyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadLobbies = useCallback(async () => {
    const { data } = await supabase
      .from("chess_lobbies")
      .select("id, host_id, created_at, profiles:host_id (display_name, first_name, avatar_key)")
      .order("created_at", { ascending: true });

    setLobbies((data as unknown as LobbyRow[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    async function init() {
      await loadLobbies();
    }
    init();

    const channel = supabase
      .channel("chess-lobbies")
      .on("postgres_changes", { event: "*", schema: "public", table: "chess_lobbies" }, loadLobbies)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, loadLobbies]);

  const myLobby = lobbies.find((l) => l.host_id === profile?.id) ?? null;

  useEffect(() => {
    if (!profile) return;
    if (!myLobby) return;

    const channel = supabase
      .channel(`chess-lobby-wait-${profile.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chess_games",
          filter: `black_player_id=eq.${profile.id}`,
        },
        (payload) => router.push(`/games/chess/${payload.new.id}`),
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chess_games",
          filter: `white_player_id=eq.${profile.id}`,
        },
        (payload) => router.push(`/games/chess/${payload.new.id}`),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, profile, myLobby, router]);

  async function handleCreateLobby() {
    setCreating(true);
    setError(null);

    const res = await fetch("/api/chess-matchmake", { method: "POST" });
    const data = await res.json();

    if (!res.ok) {
      setError(data.error === "already_in_game" ? "У тебя уже есть активная партия" : "Не удалось создать лобби");
      setCreating(false);
      return;
    }

    setCreating(false);
    loadLobbies();
  }

  async function handleCancelLobby() {
    await fetch("/api/chess-matchmake", { method: "DELETE" });
    loadLobbies();
  }

  async function handleJoin(lobbyId: string) {
    setJoiningId(lobbyId);
    setError(null);

    const res = await fetch("/api/chess-join-lobby", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lobbyId }),
    });
    const data = await res.json();

    if (!res.ok) {
      setError(
        data.error === "lobby_not_found"
          ? "Игрок уже начал другую партию"
          : "Не удалось присоединиться, попробуй ещё раз",
      );
      setJoiningId(null);
      loadLobbies();
      return;
    }

    router.push(`/games/chess/${data.gameId}`);
  }

  const otherLobbies = lobbies.filter((l) => l.host_id !== profile?.id);
  const inLobby = myLobby !== null;

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-4 max-w-md mx-auto w-full">
      <h1 className="text-xl font-bold text-center">♟️ Шахматы</h1>

      {inLobby ? (
        <div className="rounded-2xl bg-card border border-card-border p-5 flex flex-col items-center gap-3 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full" />
          <p className="text-muted">Твоё лобби открыто, ждём соперника…</p>
          <button onClick={handleCancelLobby} className="text-muted underline text-sm">
            Закрыть лобби
          </button>
        </div>
      ) : (
        <button
          onClick={handleCreateLobby}
          disabled={creating}
          className="rounded-xl bg-accent text-white px-6 py-3 font-semibold disabled:opacity-60"
        >
          {creating ? "Создаём…" : "Создать лобби"}
        </button>
      )}

      {error && <p className="text-red-500 text-sm text-center">{error}</p>}

      <div className="flex flex-col gap-2">
        <p className="text-muted text-sm font-medium">Открытые лобби</p>

        {loading && <p className="text-muted text-sm">Загрузка…</p>}

        {!loading && otherLobbies.length === 0 && (
          <p className="text-muted text-sm">Сейчас никто не ждёт игру. Создай своё лобби!</p>
        )}

        {otherLobbies.map((lobby) => (
          <div
            key={lobby.id}
            className="rounded-2xl bg-card border border-card-border p-4 flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-2xl">{avatarEmoji(lobby.profiles?.avatar_key ?? null)}</span>
              <span className="font-semibold">
                {lobby.profiles?.display_name || lobby.profiles?.first_name || "Игрок"}
              </span>
            </div>
            <button
              onClick={() => handleJoin(lobby.id)}
              disabled={joiningId === lobby.id}
              className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {joiningId === lobby.id ? "Входим…" : "Войти"}
            </button>
          </div>
        ))}
      </div>
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
