"use client";

import { useMemo, useState } from "react";

export type DailyFlowPoint = {
  date: string; // YYYY-MM-DD
  income: number;
  expense: number;
  saving: number;
};

const SERIES = [
  { key: "income" as const, label: "Доход", light: "#1baf7a", dark: "#199e70" },
  { key: "expense" as const, label: "Расход", light: "#eb6834", dark: "#d95926" },
  { key: "saving" as const, label: "Отложено", light: "#6d5bf3", dark: "#8b7bf7" },
];

const DAY_WIDTH = 46;
const BAR_WIDTH = 10;
const CHART_HEIGHT = 160;
const AXIS_HEIGHT = 24;

function formatMoney(amount: number) {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(amount);
}

function formatDayLabel(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit" });
}

export function DailyFlowChart({ points }: { points: DailyFlowPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const maxValue = useMemo(() => {
    const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense, p.saving]));
    return max;
  }, [points]);

  const plotHeight = CHART_HEIGHT - AXIS_HEIGHT;
  const chartWidth = points.length * DAY_WIDTH;

  function valueToHeight(value: number) {
    return (value / maxValue) * (plotHeight - 12);
  }

  return (
    <div className="rounded-2xl bg-card border border-card-border p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="font-semibold">Доходы / расходы / отложения по дням</p>
        <div className="flex gap-3 text-xs">
          {SERIES.map((s) => (
            <div key={s.key} className="flex items-center gap-1">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block dark:hidden"
                style={{ backgroundColor: s.light }}
              />
              <span
                className="w-2.5 h-2.5 rounded-full hidden dark:inline-block"
                style={{ backgroundColor: s.dark }}
              />
              <span className="text-muted">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-none" dir="rtl">
        <div style={{ width: chartWidth, height: CHART_HEIGHT }} className="relative" dir="ltr">
          <svg width={chartWidth} height={CHART_HEIGHT} className="block">
            <line
              x1={0}
              x2={chartWidth}
              y1={plotHeight}
              y2={plotHeight}
              stroke="var(--card-border)"
              strokeWidth={1}
            />

            {points.map((point, i) => {
              const groupX = i * DAY_WIDTH;
              const isHovered = hoverIndex === i;
              return (
                <g key={point.date}>
                  <rect
                    x={groupX}
                    y={0}
                    width={DAY_WIDTH}
                    height={plotHeight}
                    fill="transparent"
                    onMouseEnter={() => setHoverIndex(i)}
                    onMouseLeave={() => setHoverIndex(null)}
                    onTouchStart={() => setHoverIndex(i)}
                  />
                  {isHovered && (
                    <rect
                      x={groupX}
                      y={0}
                      width={DAY_WIDTH}
                      height={plotHeight}
                      fill="var(--accent)"
                      opacity={0.06}
                    />
                  )}
                  {SERIES.map((s, si) => {
                    const value = point[s.key];
                    const h = valueToHeight(value);
                    const barX = groupX + 3 + si * (BAR_WIDTH + 2);
                    return (
                      <rect
                        key={s.key}
                        x={barX}
                        y={plotHeight - h}
                        width={BAR_WIDTH}
                        height={h}
                        rx={3}
                        className="dark:hidden"
                        fill={s.light}
                        pointerEvents="none"
                      />
                    );
                  })}
                  {SERIES.map((s, si) => {
                    const value = point[s.key];
                    const h = valueToHeight(value);
                    const barX = groupX + 3 + si * (BAR_WIDTH + 2);
                    return (
                      <rect
                        key={`${s.key}-dark`}
                        x={barX}
                        y={plotHeight - h}
                        width={BAR_WIDTH}
                        height={h}
                        rx={3}
                        className="hidden dark:block"
                        fill={s.dark}
                        pointerEvents="none"
                      />
                    );
                  })}
                  <text
                    x={groupX + DAY_WIDTH / 2}
                    y={CHART_HEIGHT - 6}
                    textAnchor="middle"
                    fontSize={10}
                    fill="var(--muted)"
                  >
                    {formatDayLabel(point.date)}
                  </text>
                </g>
              );
            })}
          </svg>

          {hoverIndex !== null && (
            <div
              className="absolute top-0 rounded-xl bg-foreground text-background text-xs p-2 shadow-lg pointer-events-none z-10 flex flex-col gap-0.5 min-w-[130px]"
              style={{
                left: Math.min(
                  Math.max(hoverIndex * DAY_WIDTH - 40, 0),
                  chartWidth - 140,
                ),
              }}
            >
              <p className="font-semibold mb-0.5">{formatDayLabel(points[hoverIndex].date)}</p>
              {SERIES.map((s) => (
                <div key={s.key} className="flex justify-between gap-3">
                  <span className="opacity-80">{s.label}</span>
                  <span className="font-medium">{formatMoney(points[hoverIndex][s.key])} ₽</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="text-muted text-xs mt-2 text-center">
        ← Листай влево, чтобы увидеть начало года
      </p>
    </div>
  );
}
