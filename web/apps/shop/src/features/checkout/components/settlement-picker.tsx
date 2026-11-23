"use client";

import { useEffect, useId, useRef, useState } from "react";
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
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value?.name ?? "");
  const [options, setOptions] = useState<Settlement[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [shown, setShown] = useState(value);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");

  if (value !== shown) {
    setShown(value);
    if (value) setText(value.name);
  }

  useEffect(() => {
    if (!open) return;
    const request = new AbortController();
    const q = text.trim();
    const t = setTimeout(async () => {
      try {
        const { data } = await getSettlements(q, AbortSignal.any([request.signal, AbortSignal.timeout(10000)]));
        if (request.signal.aborted) return;
        setOptions(data ?? []);
        setStatus(data ? "done" : "error");
        setActive(0);
      } catch {
        if (!request.signal.aborted) {
          setOptions([]);
          setStatus("error");
        }
      }
    }, 180);
    return () => {
      clearTimeout(t);
      request.abort();
    };
  }, [text, open, attempt]);

  function startSearch() {
    setOptions([]);
    setStatus("loading");
    setOpen(true);
  }

  const pick = (s: Settlement) => {
    onChange(s);
    setText(s.name);
    setOpen(false);
  };

  return (
    <div className="field combo" onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label htmlFor={`${id}-input`}>Місто або село</label>
      <input
        id={`${id}-input`}
        ref={input}
        role="combobox"
        aria-expanded={open && options.length > 0}
        aria-controls={open && options.length ? `${id}-list` : undefined}
        aria-autocomplete="list"
        aria-activedescendant={open && options[active] ? `${id}-${options[active].ref}` : undefined}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        autoComplete="off"
        placeholder="Почніть вводити назву…"
        value={text}
        onFocus={() => { if (!open) startSearch(); }}
        onChange={(e) => {
          setText(e.target.value);
          startSearch();
          if (value) onChange(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) startSearch();
            else if (options.length > 0) setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && open) {
            e.preventDefault();
            if (options[active]) pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && status === "loading" && <p role="status" className="field__help">Шукаємо населений пункт…</p>}
      {open && status === "error" && <div className="field__error">
        <span role="status">Не вдалося завантажити населені пункти.</span>{" "}
        <button type="button" className="link" onClick={() => {
          input.current?.focus();
          startSearch();
          setAttempt(n => n + 1);
        }}>Повторити пошук</button>
      </div>}
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
