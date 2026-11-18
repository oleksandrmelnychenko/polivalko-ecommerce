"use client";

import { useState } from "react";
import { MAX_QUANTITY } from "@/shared/lib/quantity";

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
  const [typed, setTyped] = useState<string | null>(null);
  const [shown, setShown] = useState(value);
  const set = (n: number) => onChange(Math.min(Math.max(Math.round(n), 1), max));

  if (shown !== value) {
    setShown(value);
    if (typed !== null && Number(typed) !== value) setTyped(null);
  }

  function step(next: number) {
    setTyped(null);
    set(next);
  }

  function type(text: string) {
    setTyped(text);
    const n = Number(text);
    if (text.trim() !== "" && Number.isFinite(n) && n >= 1) set(n);
  }

  return (
    <div className={small ? "stepper stepper--small" : "stepper"} role="group" aria-label={label}>
      <button type="button" onClick={() => step(value - 1)} disabled={value <= 1} aria-label="Зменшити кількість">
        &minus;
      </button>
      <input
        type="number"
        name="quantity"
        inputMode="numeric"
        autoComplete="off"
        min={1}
        max={max}
        value={typed ?? value}
        aria-label="Кількість"
        onChange={(e) => type(e.target.value)}
        onBlur={() => setTyped(null)}
      />
      <button type="button" onClick={() => step(value + 1)} disabled={value >= max} aria-label="Збільшити кількість">
        +
      </button>
    </div>
  );
}
