"use client";

import { useId, useState } from "react";

export function QuantityStepper({ value, onChange, label, max = 0, small }: {
  value: number; onChange: (value: number) => void; label: string; max?: number; small?: boolean;
}) {
  const hintId = useId();
  const [empty, setEmpty] = useState(false);
  const [hint, setHint] = useState("");
  function change(amount: number) {
    setEmpty(false);
    setHint(amount > max ? `Доступно: ${max} шт.` : amount < 1 ? "Мінімальна кількість — 1." : "");
    if (max > 0) onChange(Math.min(max, Math.max(1, amount)));
  }
  return <div className="quantity-feedback">
    <div className={small ? "stepper stepper--small" : "stepper"} role="group" aria-label={label}>
      <button type="button" onClick={() => change(value - 1)} disabled={value <= 1 || max < 1} aria-label="Зменшити кількість">&minus;</button>
      <input type="text" role="spinbutton" name="quantity" inputMode="numeric" autoComplete="off"
        disabled={max < 1} value={empty ? "" : value} aria-label="Кількість" aria-valuenow={value} aria-valuemin={1} aria-valuemax={max || undefined}
        aria-describedby={hint ? hintId : undefined}
        onChange={(event) => {
          const text = event.currentTarget.value;
          if (!text) { setEmpty(true); setHint(""); }
          else if (/^[0-9]+$/.test(text)) change(Number(text));
          else setHint("Введіть цілу кількість.");
        }}
        onKeyDown={(event) => {
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          change(value + (event.key === "ArrowUp" ? 1 : -1));
        }}
        onBlur={() => setEmpty(false)} />
      <button type="button" onClick={() => change(value + 1)} disabled={value >= max} aria-label="Збільшити кількість">+</button>
    </div>
    <small id={hintId} role="status" hidden={!hint}>{hint}</small>
  </div>;
}
