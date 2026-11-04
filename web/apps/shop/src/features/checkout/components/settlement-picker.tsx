"use client";

import { useEffect, useId, useState } from "react";
import type { Settlement } from "@polivalko/shared/api/types";
import { getSettlements } from "../api/client";

export function SettlementPicker({
  value,
  onChange,
  error,
}: {
  value: Settlement | null;
  onChange: (s: Settlement | null) => void;
  error?: string;
}) {
  const id = useId();
  const [text, setText] = useState(value?.name ?? "");
  const [options, setOptions] = useState<Settlement[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(value);

  if (value !== shown) {
    setShown(value);
    if (value) setText(value.name);
  }

  useEffect(() => {
    if (!open) return;
    const q = text.trim();
    const t = setTimeout(async () => {
      const { data } = await getSettlements(q);
      setOptions(data ?? []);
      setActive(0);
    }, 180);
    return () => clearTimeout(t);
  }, [text, open]);

  const pick = (s: Settlement) => {
    onChange(s);
    setText(s.name);
    setOpen(false);
  };

  return (
    <div className="field combo">
      <label htmlFor={`${id}-input`}>Місто або село</label>
      <input
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-${options[active].ref}` : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        placeholder="Почніть вводити назву…"
        value={text}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open && options[active]) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && options.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="combo__list">
          {options.map((s, i) => (
            <li
              key={s.ref}
              id={`${id}-${s.ref}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
            >
              {s.name}
              <small>{s.area}</small>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p id={`${id}-error`} className="field__error">
          {error}
        </p>
      )}
    </div>
  );
}
