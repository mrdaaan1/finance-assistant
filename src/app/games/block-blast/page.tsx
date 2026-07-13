"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AuthGate } from "@/components/AuthGate";
import { useSession } from "@/lib/finance/session-context";
import {
  GRID_SIZE,
  canPlaceShapeAt,
  createEmptyGrid,
  generateTray,
  isGameOver,
  placeShape,
  scoreForMove,
  type Grid,
  type ShapeDef,
} from "@/lib/games/block-blast";

const CELL_SIZE = 34;
const CELL_GAP = 4;

type DragState = {
  shapeIndex: number;
  pointerId: number;
  x: number;
  y: number;
};

function formatScore(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

function BlockBlastContent() {
  const { profile, refreshProfile } = useSession();
  const [grid, setGrid] = useState<Grid>(() => createEmptyGrid());
  const [tray, setTray] = useState<ShapeDef[]>(() => generateTray());
  const [score, setScore] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);

  // "Игра окончена" — чистая производная от текущих grid/tray, а не
  // независимое состояние: не нужен эффект, синхронизирующий одно с другим.
  const gameOver = tray.length > 0 && isGameOver(grid, tray);
  const [savingScore, setSavingScore] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  const boardRef = useRef<HTMLDivElement>(null);
  const boardRect = useRef<DOMRect | null>(null);
  const submittedRef = useRef(false);

  const bestScore = profile?.block_blast_best_score ?? 0;

  const resetGame = useCallback(() => {
    setGrid(createEmptyGrid());
    setTray(generateTray());
    setScore(0);
    setNewRecord(false);
    submittedRef.current = false;
  }, []);

  useEffect(() => {
    if (!gameOver || submittedRef.current) return;
    submittedRef.current = true;

    let cancelled = false;
    async function submit(finalScore: number) {
      setSavingScore(true);
      try {
        const res = await fetch("/api/block-blast-score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: finalScore }),
        });
        if (res.ok && !cancelled) {
          const { bestScore: newBest } = await res.json();
          if (newBest > bestScore) setNewRecord(true);
          await refreshProfile();
        }
      } finally {
        if (!cancelled) setSavingScore(false);
      }
    }
    submit(score);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameOver]);

  function cellFromPoint(clientX: number, clientY: number): { row: number; col: number } | null {
    const rect = boardRect.current;
    if (!rect) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const col = Math.floor(x / (CELL_SIZE + CELL_GAP));
    const row = Math.floor(y / (CELL_SIZE + CELL_GAP));
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    return { row, col };
  }

  function handlePointerDown(e: React.PointerEvent, shapeIndex: number) {
    if (gameOver) return;
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    // Кэшируем прямоугольник доски один раз на весь перенос — дешевле, чем
    // читать getBoundingClientRect на каждый pointermove.
    boardRect.current = boardRef.current?.getBoundingClientRect() ?? null;
    setDrag({ shapeIndex, pointerId: e.pointerId, x: e.clientX, y: e.clientY });
  }

  function handlePointerMove(e: React.PointerEvent) {
    setDrag((prev) => (prev && prev.pointerId === e.pointerId ? { ...prev, x: e.clientX, y: e.clientY } : prev));
  }

  function handlePointerUp(e: React.PointerEvent) {
    if (!drag || drag.pointerId !== e.pointerId) return;

    // Точка выше центра пальца/курсора — фигура визуально приподнята над
    // пальцем при переносе, целимся туда же, куда её показываем (см. рендер ниже).
    const targetY = e.clientY - CELL_SIZE * 1.6;
    const cell = cellFromPoint(e.clientX, targetY);
    const shape = tray[drag.shapeIndex];

    // handlePointerUp — обработчик события, пересоздаётся при каждом рендере
    // и замыкает актуальные grid/tray из последнего рендера, так что читать
    // их напрямую здесь безопасно — вложенные функциональные setState друг
    // в друге не нужны и только усложняют код.
    if (cell && shape && canPlaceShapeAt(grid, shape.cells, cell.row, cell.col)) {
      const { grid: nextGrid, clearedLines, cellsPlaced } = placeShape(grid, shape.cells, cell.row, cell.col);
      setGrid(nextGrid);
      setScore((s) => s + scoreForMove(cellsPlaced, clearedLines));
      setTray((prevTray) => {
        const rest = prevTray.filter((_, i) => i !== drag.shapeIndex);
        return rest.length === 0 ? generateTray() : rest;
      });
    }

    setDrag(null);
  }

  return (
    <main className="flex-1 flex flex-col px-4 py-6 gap-4 max-w-md mx-auto w-full select-none">
      <div className="flex items-center gap-3">
        <Link
          href="/games"
          aria-label="Назад к играм"
          className="w-10 h-10 rounded-full bg-card border border-card-border flex items-center justify-center text-lg text-muted"
        >
          ←
        </Link>
        <div>
          <h1 className="text-xl font-bold">🧩 Блок-пазл</h1>
          <p className="text-muted text-sm">Заполняй строки и столбцы</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-gradient-to-br from-accent to-accent-dark text-white p-4">
          <p className="text-white/80 text-xs uppercase tracking-wide">Очки</p>
          <p className="text-2xl font-extrabold">{formatScore(score)}</p>
        </div>
        <div className="rounded-2xl bg-card border border-card-border p-4">
          <p className="text-muted text-xs uppercase tracking-wide">Рекорд</p>
          <p className="text-2xl font-extrabold">{formatScore(bestScore)}</p>
        </div>
      </div>

      <BlockBlastBoard
        boardRef={boardRef}
        grid={grid}
        tray={tray}
        drag={drag}
        gameOver={gameOver}
        onPointerDownShape={handlePointerDown}
        cellFromPoint={cellFromPoint}
      />

      <p className="text-muted text-xs text-center">
        Перетащи фигуру на поле — заполненные строки и столбцы очищаются и приносят очки
      </p>

      {gameOver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-3xl bg-card border border-card-border p-6 flex flex-col items-center gap-3 text-center">
            <p className="text-2xl">🧩</p>
            <p className="text-lg font-extrabold">Игра окончена</p>
            <p className="text-muted text-sm">Свободных ходов больше нет</p>
            <p className="text-3xl font-extrabold mt-1">{formatScore(score)}</p>
            {newRecord && <p className="text-accent font-semibold text-sm">🎉 Новый рекорд!</p>}
            {savingScore && <p className="text-muted text-xs">Сохраняю результат…</p>}
            <button
              onClick={resetGame}
              className="w-full rounded-xl bg-accent text-white py-3 font-semibold mt-2"
            >
              Играть снова
            </button>
          </div>
        </div>
      )}

      {/* Отлавливаем pointerup/move даже если курсор ушёл с фигуры лотка */}
      <div
        className="fixed inset-0 z-40"
        style={{ pointerEvents: drag ? "auto" : "none" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
    </main>
  );
}

function BlockBlastBoard({
  boardRef,
  grid,
  tray,
  drag,
  gameOver,
  onPointerDownShape,
  cellFromPoint,
}: {
  boardRef: React.RefObject<HTMLDivElement | null>;
  grid: Grid;
  tray: ShapeDef[];
  drag: DragState | null;
  gameOver: boolean;
  onPointerDownShape: (e: React.PointerEvent, shapeIndex: number) => void;
  cellFromPoint: (x: number, y: number) => { row: number; col: number } | null;
}) {
  const draggedShape = drag ? tray[drag.shapeIndex] : null;
  const ghostCell = drag && draggedShape ? cellFromPoint(drag.x, drag.y - CELL_SIZE * 1.6) : null;
  const ghostValid =
    ghostCell && draggedShape ? canPlaceShapeAt(grid, draggedShape.cells, ghostCell.row, ghostCell.col) : false;

  return (
    <div className="rounded-2xl bg-card border border-card-border p-4 flex flex-col items-center gap-5">
      <div
        ref={boardRef}
        className="relative bg-background rounded-xl p-1"
        style={{
          width: GRID_SIZE * (CELL_SIZE + CELL_GAP) + CELL_GAP,
          height: GRID_SIZE * (CELL_SIZE + CELL_GAP) + CELL_GAP,
        }}
      >
        {grid.map((rowArr, r) =>
          rowArr.map((filled, c) => {
            const isGhost =
              ghostCell &&
              draggedShape &&
              r >= ghostCell.row &&
              r < ghostCell.row + draggedShape.cells.length &&
              c >= ghostCell.col &&
              c < ghostCell.col + (draggedShape.cells[r - ghostCell.row]?.length ?? 0) &&
              draggedShape.cells[r - ghostCell.row]?.[c - ghostCell.col];

            return (
              <div
                key={`${r}-${c}`}
                className={`absolute rounded-md transition-colors ${
                  filled
                    ? "bg-accent"
                    : isGhost
                      ? ghostValid
                        ? "bg-accent/30"
                        : "bg-red-400/30"
                      : "bg-card-border/40"
                }`}
                style={{
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  left: CELL_GAP + c * (CELL_SIZE + CELL_GAP),
                  top: CELL_GAP + r * (CELL_SIZE + CELL_GAP),
                }}
              />
            );
          }),
        )}
      </div>

      <div className="flex gap-4 items-start justify-center min-h-[90px] w-full">
        {tray.map((shape, i) => {
          const isDragging = drag?.shapeIndex === i;
          const rows = shape.cells.length;
          const cols = shape.cells[0].length;
          const miniCell = 18;
          return (
            <div
              key={shape.id}
              onPointerDown={(e) => !gameOver && onPointerDownShape(e, i)}
              className="relative touch-none cursor-grab active:cursor-grabbing"
              style={{ opacity: isDragging ? 0.3 : 1, width: cols * miniCell, height: rows * miniCell }}
            >
              {shape.cells.map((rowArr, r) =>
                rowArr.map(
                  (on, c) =>
                    on && (
                      <div
                        key={`${r}-${c}`}
                        className="absolute bg-accent rounded-sm"
                        style={{
                          width: miniCell - 3,
                          height: miniCell - 3,
                          transform: `translate(${c * miniCell}px, ${r * miniCell}px)`,
                        }}
                      />
                    ),
                ),
              )}
            </div>
          );
        })}
      </div>

      {/* Фигура, следующая за пальцем/курсором во время переноса */}
      {drag && draggedShape && (
        <div
          className="fixed pointer-events-none z-50"
          style={{
            left: drag.x - (draggedShape.cells[0].length * CELL_SIZE) / 2,
            top: drag.y - CELL_SIZE * 1.6 - (draggedShape.cells.length * CELL_SIZE) / 2,
          }}
        >
          {draggedShape.cells.map((rowArr, r) =>
            rowArr.map(
              (on, c) =>
                on && (
                  <div
                    key={`${r}-${c}`}
                    className="absolute bg-accent rounded-md opacity-90"
                    style={{
                      width: CELL_SIZE - 4,
                      height: CELL_SIZE - 4,
                      transform: `translate(${c * CELL_SIZE}px, ${r * CELL_SIZE}px)`,
                    }}
                  />
                ),
            ),
          )}
        </div>
      )}
    </div>
  );
}

export default function BlockBlastPage() {
  return (
    <AuthGate>
      <BlockBlastContent />
    </AuthGate>
  );
}
