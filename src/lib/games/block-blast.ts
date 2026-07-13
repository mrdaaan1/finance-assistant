// Движок игры "Блок-пазл" (аналог Block Blast): сетка 8x8, тройка фигур
// в лотке, перетаскивание на поле, полностью заполненные строки/столбцы
// очищаются и приносят очки. Игра заканчивается, когда ни одна из фигур
// в лотке никуда не помещается.

export const GRID_SIZE = 8;

export type Grid = boolean[][];
export type Shape = boolean[][];

export type ShapeDef = {
  id: string;
  cells: Shape;
};

// Библиотека фигур: от одиночного блока до крупных — как в оригинале, набор
// разного размера и формы, чтобы игра не решалась тривиально.
const SHAPE_LIBRARY: Shape[] = [
  [[true]],
  [[true, true]],
  [[true], [true]],
  [[true, true, true]],
  [[true], [true], [true]],
  [
    [true, true],
    [true, true],
  ],
  [[true, true, true, true]],
  [[true], [true], [true], [true]],
  [
    [true, true, true],
    [true, false, false],
  ],
  [
    [true, true, true],
    [false, false, true],
  ],
  [
    [true, false],
    [true, false],
    [true, true],
  ],
  [
    [false, true],
    [false, true],
    [true, true],
  ],
  [
    [true, true, true],
    [false, true, false],
  ],
  [
    [false, true, false],
    [true, true, true],
  ],
  [
    [true, true],
    [true, false],
  ],
  [
    [true, true],
    [false, true],
  ],
  [
    [true, false],
    [true, true],
  ],
  [
    [false, true],
    [true, true],
  ],
  [
    [true, true, true],
    [true, true, true],
    [true, true, true],
  ],
];

let shapeIdCounter = 0;

export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () => Array<boolean>(GRID_SIZE).fill(false));
}

export function randomShape(): ShapeDef {
  const cells = SHAPE_LIBRARY[Math.floor(Math.random() * SHAPE_LIBRARY.length)];
  shapeIdCounter += 1;
  return { id: `shape-${shapeIdCounter}`, cells };
}

export function generateTray(): ShapeDef[] {
  return [randomShape(), randomShape(), randomShape()];
}

/** Может ли фигура быть размещена в позиции (row, col) без выхода за границы и пересечений. */
export function canPlaceShapeAt(grid: Grid, shape: Shape, row: number, col: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const gr = row + r;
      const gc = col + c;
      if (gr < 0 || gr >= GRID_SIZE || gc < 0 || gc >= GRID_SIZE) return false;
      if (grid[gr][gc]) return false;
    }
  }
  return true;
}

/** Есть ли хоть одна позиция на поле, куда фигура помещается. */
export function canPlaceShapeAnywhere(grid: Grid, shape: Shape): boolean {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      if (canPlaceShapeAt(grid, shape, r, c)) return true;
    }
  }
  return false;
}

/** Игра окончена, если ни одна фигура в лотке никуда не помещается. */
export function isGameOver(grid: Grid, tray: ShapeDef[]): boolean {
  return tray.every((shape) => !canPlaceShapeAnywhere(grid, shape.cells));
}

export type PlaceResult = {
  grid: Grid;
  clearedLines: number;
  cellsPlaced: number;
};

/** Размещает фигуру, очищает заполненные строки/столбцы, возвращает новую сетку. */
export function placeShape(grid: Grid, shape: Shape, row: number, col: number): PlaceResult {
  const next = grid.map((r) => [...r]);
  let cellsPlaced = 0;

  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      next[row + r][col + c] = true;
      cellsPlaced += 1;
    }
  }

  const fullRows: number[] = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    if (next[r].every(Boolean)) fullRows.push(r);
  }

  const fullCols: number[] = [];
  for (let c = 0; c < GRID_SIZE; c++) {
    if (next.every((rowArr) => rowArr[c])) fullCols.push(c);
  }

  for (const r of fullRows) {
    next[r] = Array<boolean>(GRID_SIZE).fill(false);
  }
  for (const c of fullCols) {
    for (let r = 0; r < GRID_SIZE; r++) next[r][c] = false;
  }

  return { grid: next, clearedLines: fullRows.length + fullCols.length, cellsPlaced };
}

/** Очки за ход: блоки размещения + бонус за очищенные линии (растёт с комбо). */
export function scoreForMove(cellsPlaced: number, clearedLines: number): number {
  if (clearedLines === 0) return cellsPlaced;
  return cellsPlaced + clearedLines * GRID_SIZE * (1 + (clearedLines - 1) * 0.5);
}
