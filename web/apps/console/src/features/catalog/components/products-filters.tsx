"use client";

import { useState, type FormEvent } from "react";
import { SearchIcon } from "@polivalko/shared/ui/icons";
import type { ProductFilter, ProductFilters } from "../lib/product-filters";

export function ProductsFilters({
  f,
  options,
  filtered,
  go,
  reset,
}: {
  f: ProductFilters;
  options: { id: string; name: string }[];
  filtered: boolean;
  go: (patch: Partial<Record<ProductFilter | "page", string>>) => void;
  reset: () => void;
}) {
  const [text, setText] = useState(f.q);
  return (
    <form
      className="console-filters"
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
          <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Назва або артикул…" autoComplete="off" spellCheck={false} />
        </span>
      </div>
      <div className="field">
        <label htmlFor="category">Розділ</label>
        <select id="category" value={f.categoryId} onChange={(e) => go({ categoryId: e.target.value })}>
          <option value="">Усі розділи</option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="stock">Залишок</label>
        <select id="stock" value={f.stock} onChange={(e) => go({ stock: e.target.value })}>
          <option value="">Будь-який</option>
          <option value="in">Є в наявності</option>
          <option value="low">Закінчується (до 3)</option>
          <option value="out">Немає</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="visible">На сайті</label>
        <select id="visible" value={f.visible} onChange={(e) => go({ visible: e.target.value })}>
          <option value="">Усі</option>
          <option value="true">Показуються</option>
          <option value="false">Приховані</option>
        </select>
      </div>
      <div className="console-filters__actions">
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
