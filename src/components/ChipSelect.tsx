"use client";

export type ChipOption<T extends string> = {
  value: T;
  label: string;
  icon?: string;
};

export function ChipSelect<T extends string>({
  options,
  value,
  onChange,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
              active
                ? "bg-accent text-white border-accent"
                : "bg-background text-foreground border-card-border"
            }`}
          >
            {option.icon && <span className="text-base leading-none">{option.icon}</span>}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
