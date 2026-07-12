"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Chess } from "chess.js";
import { Chessboard } from "react-chessboard";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";

type ChessGameRow = {
  id: string;
  white_player_id: string;
  black_player_id: string;
  fen: string;
  status: "active" | "finished";
  winner_id: string | null;
};

function ChessGameContent() {
  const { supabase, profile } = useSession();
  const params = useParams<{ gameId: string }>();
  const router = useRouter();

  const [game, setGame] = useState<ChessGameRow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const chess = useMemo(() => new Chess(game?.fen), [game?.fen]);
  const gameRef = useRef(game);
  gameRef.current = game;

  useEffect(() => {
    let active = true;

    async function load() {
      const { data } = await supabase
        .from("chess_games")
        .select("id, white_player_id, black_player_id, fen, status, winner_id")
        .eq("id", params.gameId)
        .maybeSingle();

      if (active && data) setGame(data as ChessGameRow);
    }
    load();

    const channel = supabase
      .channel(`chess-game-${params.gameId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "chess_games",
          filter: `id=eq.${params.gameId}`,
        },
        (payload) => {
          if (active) setGame(payload.new as ChessGameRow);
        },
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [supabase, params.gameId]);

  if (!game || !profile) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <p className="text-muted">Загрузка партии…</p>
      </main>
    );
  }

  const isWhite = game.white_player_id === profile.id;
  const myTurn = game.status === "active" && chess.turn() === (isWhite ? "w" : "b");

  function handleDrop({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) {
    if (!targetSquare || !myTurn || !gameRef.current || !profile) return false;

    const attempt = new Chess(gameRef.current.fen);
    let move;
    try {
      move = attempt.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
    } catch {
      return false;
    }
    if (!move) return false;

    const isGameOver = attempt.isGameOver();
    const winnerId = isGameOver && attempt.isCheckmate() ? profile.id : null;
    const currentGameId = gameRef.current.id;

    // Оптимистично обновляем локально сразу, чтобы доска не откатывалась,
    // пока ждём подтверждения от сервера.
    setGame((prev) =>
      prev
        ? { ...prev, fen: attempt.fen(), status: isGameOver ? "finished" : "active", winner_id: winnerId }
        : prev,
    );

    supabase
      .from("chess_games")
      .update({
        fen: attempt.fen(),
        status: isGameOver ? "finished" : "active",
        winner_id: winnerId,
        last_move_at: new Date().toISOString(),
      })
      .eq("id", currentGameId)
      .then(({ error: updateError }) => {
        if (updateError) setError("Не удалось сохранить ход, попробуй снова");
      });

    return true;
  }

  function handleLeave() {
    router.push("/games/chess");
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-4 max-w-md mx-auto w-full items-center">
      <h1 className="text-xl font-bold">♟️ Партия</h1>

      <p className="text-muted text-sm">
        {game.status === "finished"
          ? game.winner_id === profile.id
            ? "Ты выиграл! 🎉"
            : game.winner_id
              ? "Соперник победил"
              : "Ничья"
          : myTurn
            ? "Твой ход"
            : "Ход соперника…"}
      </p>

      <div className="w-full max-w-sm">
        <Chessboard
          options={{
            position: chess.fen(),
            onPieceDrop: handleDrop,
            boardOrientation: isWhite ? "white" : "black",
            allowDragging: myTurn,
          }}
        />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      {game.status === "finished" && (
        <button onClick={handleLeave} className="rounded-xl bg-accent text-white px-6 py-3 font-semibold">
          Найти новую игру
        </button>
      )}
    </main>
  );
}

export default function ChessGamePage() {
  return (
    <AuthGate>
      <ChessGameContent />
    </AuthGate>
  );
}
