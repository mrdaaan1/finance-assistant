"use client";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: string;
};

export function SegmentedSelect<T extends string>({
  options,
  value,
  onChange,
  columns = options.length,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  columns?: number;
}) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition-colors ${
              active
                ? "bg-accent text-white border-accent"
                : "bg-background text-muted border-card-border"
            }`}
          >
            {option.icon && <span className="text-lg leading-none">{option.icon}</span>}
            <span className="text-center leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
