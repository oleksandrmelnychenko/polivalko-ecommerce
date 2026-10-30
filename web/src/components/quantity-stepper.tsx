"use client";

import { MAX_QUANTITY } from "@/lib/cart";

export function QuantityStepper({
  value,
  onChange,
  label,
  max = MAX_QUANTITY,
  small,
}: {
  value: number;
  onChange: (value: number) => void;
  label: string;
  max?: number;
  small?: boolean;
}) {
  const set = (n: number) => onChange(Math.min(Math.max(Number.isFinite(n) ? Math.round(n) : 1, 1), max));
  return (
    <div className={small ? "stepper stepper--small" : "stepper"} role="group" aria-label={label}>
      <button type="button" onClick={() => set(value - 1)} disabled={value <= 1} aria-label="Зменшити кількість">
        &minus;
      </button>
      <input
        type="number"
        name="quantity"
        inputMode="numeric"
        autoComplete="off"
        min={1}
        max={max}
        value={value}
        aria-label="Кількість"
        onChange={(e) => set(Number(e.target.value))}
      />
      <button type="button" onClick={() => set(value + 1)} disabled={value >= max} aria-label="Збільшити кількість">
        +
      </button>
    </div>
  );
}
