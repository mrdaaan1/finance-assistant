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
// Фигура визуально приподнята над пальцем/курсором на это расстояние по Y —
// иначе на телефоне палец полностью закрывает то, что переносишь.
const LIFT_Y = CELL_SIZE * 1.6;

type DragState = {
  shapeIndex: number;
  pointerId: number;
  x: number;
  y: number;
};

function formatScore(n: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.round(n));
}

/**
 * Единая точка правды для положения переносимой фигуры: и рендер (где
 * рисуем полупрозрачную фигуру и "призрак" на доске), и определение
 * ячейки-цели при отпускании обязаны использовать один и тот же расчёт
 * верхнего левого угла — иначе визуальная позиция и фактическое место
 * попадания расходятся (баг "ставится на клетку правее" на широких фигурах:
 * раньше X брался без поправки на центрирование фигуры, а Y — с поправкой).
 */
function dragTopLeft(x: number, y: number, shape: ShapeDef): { left: number; top: number } {
  const cols = shape.cells[0].length;
  const rows = shape.cells.length;
  return {
    left: x - (cols * CELL_SIZE) / 2,
    top: y - LIFT_Y - (rows * CELL_SIZE) / 2,
  };
}

function BlockBlastContent() {
  const { profile, refreshProfile } = useSession();
  const [grid, setGrid] = useState<Grid>(() => createEmptyGrid());
  const [tray, setTray] = useState<ShapeDef[]>(() => generateTray());
  const [score, setScore] = useState(0);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [savingScore, setSavingScore] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  // "Игра окончена" — чистая производная от текущих grid/tray, а не
  // независимое состояние: не нужен эффект, синхронизирующий одно с другим.
  const gameOver = tray.length > 0 && isGameOver(grid, tray);

  const boardRef = useRef<HTMLDivElement>(null);
  const boardRect = useRef<DOMRect | null>(null);
  const submittedRef = useRef(false);
  // handlePointerMove/Up регистрируются на window нативно (см. ниже) — им
  // нужен доступ к актуальным grid/tray без пересоздания слушателей на
  // каждый рендер, поэтому дублируем значения в рефы.
  const gridRef = useRef(grid);
  const trayRef = useRef(tray);
  const dragRef = useRef(drag);

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

  function cellFromTopLeft(left: number, top: number): { row: number; col: number } | null {
    const rect = boardRect.current;
    if (!rect) return null;
    const x = left - rect.left;
    const y = top - rect.top;
    const col = Math.round(x / (CELL_SIZE + CELL_GAP));
    const row = Math.round(y / (CELL_SIZE + CELL_GAP));
    if (row < 0 || row >= GRID_SIZE || col < 0 || col >= GRID_SIZE) return null;
    return { row, col };
  }

  const finishDrag = useCallback((clientX: number, clientY: number, shapeIndex: number) => {
    const shape = trayRef.current[shapeIndex];
    if (!shape) return;

    const { left, top } = dragTopLeft(clientX, clientY, shape);
    const cell = cellFromTopLeft(left, top);

    if (cell && canPlaceShapeAt(gridRef.current, shape.cells, cell.row, cell.col)) {
      const { grid: nextGrid, clearedLines, cellsPlaced } = placeShape(
        gridRef.current,
        shape.cells,
        cell.row,
        cell.col,
      );
      setGrid(nextGrid);
      setScore((s) => s + scoreForMove(cellsPlaced, clearedLines));
      setTray((prevTray) => {
        const rest = prevTray.filter((_, i) => i !== shapeIndex);
        return rest.length === 0 ? generateTray() : rest;
      });
    }
  }, []);

  // Слушатели переноса вешаем на window нативно с {passive: false}, а не
  // через React onPointerMove/onPointerUp — тот же паттерн, что уже чинил
  // скролл графика на дашборде (см. DailyFlowChart): React вешает touch-
  // обработчики как passive, из-за чего Telegram WebView (и мобильный Safari)
  // сам решает, что палец на экране — это скролл страницы, может дёрнуть
  // viewport и не всегда доносит финальный pointerup до React. preventDefault
  // здесь глушит нативный скролл/зум на время переноса фигуры.
  useEffect(() => {
    if (!drag) return;

    function handleMove(e: PointerEvent) {
      if (e.pointerId !== dragRef.current?.pointerId) return;
      e.preventDefault();
      setDrag((prev) => (prev && prev.pointerId === e.pointerId ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    }

    function handleUp(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      e.preventDefault();
      finishDrag(e.clientX, e.clientY, current.shapeIndex);
      setDrag(null);
    }

    window.addEventListener("pointermove", handleMove, { passive: false });
    window.addEventListener("pointerup", handleUp, { passive: false });
    window.addEventListener("pointercancel", handleUp, { passive: false });
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [drag, finishDrag]);

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);
  useEffect(() => {
    trayRef.current = tray;
  }, [tray]);
  useEffect(() => {
    dragRef.current = drag;
  }, [drag]);

  function handlePointerDown(e: React.PointerEvent, shapeIndex: number) {
    if (gameOver) return;
    e.preventDefault();
    // Кэшируем прямоугольник доски один раз на весь перенос — дешевле, чем
    // читать getBoundingClientRect на каждый pointermove.
    boardRect.current = boardRef.current?.getBoundingClientRect() ?? null;
    setDrag({ shapeIndex, pointerId: e.pointerId, x: e.clientX, y: e.clientY });
  }

  return (
    <main
      className="flex-1 flex flex-col px-4 py-6 gap-4 max-w-md mx-auto w-full select-none"
      style={drag ? { touchAction: "none", overscrollBehavior: "none" } : undefined}
    >
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
        cellFromTopLeft={cellFromTopLeft}
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
  cellFromTopLeft,
}: {
  boardRef: React.RefObject<HTMLDivElement | null>;
  grid: Grid;
  tray: ShapeDef[];
  drag: DragState | null;
  gameOver: boolean;
  onPointerDownShape: (e: React.PointerEvent, shapeIndex: number) => void;
  cellFromTopLeft: (left: number, top: number) => { row: number; col: number } | null;
}) {
  const draggedShape = drag ? tray[drag.shapeIndex] : null;
  const dragPos = drag && draggedShape ? dragTopLeft(drag.x, drag.y, draggedShape) : null;
  const ghostCell = dragPos ? cellFromTopLeft(dragPos.left, dragPos.top) : null;
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
          touchAction: "none",
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

      <div className="flex gap-4 items-start justify-center min-h-[90px] w-full" style={{ touchAction: "none" }}>
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
      {drag && draggedShape && dragPos && (
        <div
          className="fixed pointer-events-none z-50"
          style={{ left: dragPos.left, top: dragPos.top }}
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
