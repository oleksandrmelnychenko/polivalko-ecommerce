"use client";

import { useState, type FormEvent } from "react";
import { deliveryMethodLabel, paymentStatusLabel } from "@/shared/lib/labels";
import { SearchIcon } from "@/shared/ui/icons";
import type { Filter, Filters } from "../lib/order-filters";

export function OrdersFilters({
  f,
  filtered,
  go,
  reset,
}: {
  f: Filters;
  filtered: boolean;
  go: (patch: Partial<Record<Filter | "page", string>>) => void;
  reset: () => void;
}) {
  const [text, setText] = useState(f.q);
  return (
    <form
      className="admin-filters"
      role="search"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        go({ q: text.trim() });
      }}
    >
      <div className="field field--wide">
        <label htmlFor="q">Пошук</label>
        <span className="input-icon">
          <SearchIcon />
          <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Номер, телефон, ім'я…" autoComplete="off" spellCheck={false} />
        </span>
      </div>
      <div className="field">
        <label htmlFor="paymentStatus">Оплата</label>
        <select id="paymentStatus" value={f.paymentStatus} onChange={(e) => go({ paymentStatus: e.target.value })}>
          <option value="">Будь-яка</option>
          {Object.entries(paymentStatusLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="delivery">Отримання</label>
        <select id="delivery" value={f.delivery} onChange={(e) => go({ delivery: e.target.value })}>
          <option value="">Будь-яке</option>
          {Object.entries(deliveryMethodLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field field--date">
        <label htmlFor="from">Від</label>
        <input id="from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => go({ from: e.target.value })} />
      </div>
      <div className="field field--date">
        <label htmlFor="to">До</label>
        <input id="to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => go({ to: e.target.value })} />
      </div>
      <div className="admin-filters__actions">
        <button type="submit" className="btn">
          Знайти
        </button>
        {filtered && (
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              setText("");
              reset();
            }}
          >
            Скинути
          </button>
        )}
      </div>
    </form>
  );
}
