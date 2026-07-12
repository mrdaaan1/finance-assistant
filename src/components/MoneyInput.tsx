"use client";

import { useState } from "react";

function formatWithSpaces(digits: string): string {
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export function MoneyInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string;
  onChange: (rawValue: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(formatWithSpaces(value));

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const digits = e.target.value.replace(/\D/g, "");
    onChange(digits);
    setDisplay(formatWithSpaces(digits));
  }

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={display}
        onChange={handleChange}
        className={className}
      />
      {display && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">
          ₽
        </span>
      )}
    </div>
  );
}
