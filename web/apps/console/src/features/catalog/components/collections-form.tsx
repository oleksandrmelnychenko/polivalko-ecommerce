"use client";

import { useState, type FormEvent } from "react";
import { withCsrf } from "@/shared/csrf";
import { FieldError } from "@/shared/form/field-error";
import { fieldErrors, problemTitle } from "@polivalko/shared/api/problem";
import { deleteCollection, getProducts, saveCollection } from "../api/client";
import type { ConsoleCollection, ProductRow } from "../lib/types";
import { CollectionsItems } from "./collections-items";

export function CollectionsForm({ collection, onDone }: { collection: ConsoleCollection | null; onDone: () => void }) {
  const [items, setItems] = useState<ProductRow[]>(collection?.products ?? []);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<ProductRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    const { data } = await getProducts({ q: query.trim() || undefined, visible: true, pageSize: 20 });
    setFound(data?.items ?? []);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      code: String(form.get("code") ?? "").trim(),
      title: String(form.get("title") ?? "").trim(),
      sortOrder: Number(form.get("sortOrder")) || 0,
      isVisible: form.get("isVisible") === "on",
      productIds: items.map((i) => i.id),
    };
    setBusy(true);
    setError(null);
    const result = await withCsrf((headers) => saveCollection(headers, collection ? collection.id : null, body));
    setBusy(false);
    if (result.data) onDone();
    else {
      setErrors(fieldErrors(result.error));
      setError(problemTitle(result.error, "Не збережено."));
    }
  }

  async function remove() {
    if (!collection) return;
    const result = await withCsrf((headers) => deleteCollection(headers, collection.id));
    if (result.response.ok) onDone();
    else setError(problemTitle(result.error, "Добірку не видалено."));
  }

  return (
    <div className="console-panel console-form">
      <form className="console-form" id="collection-form" onSubmit={submit} noValidate>
        <h2>{collection ? `Добірка «${collection.title}»` : "Нова добірка"}</h2>
        <div className="field">
          <label htmlFor="title">Заголовок на головній</label>
          <input id="title" name="title" defaultValue={collection?.title ?? "Рекомендовані товари"} maxLength={200} required />
          <FieldError id="title-error" message={errors.title} />
        </div>
        <div className="field">
          <label htmlFor="code">Код (латиницею)</label>
          <input id="code" name="code" defaultValue={collection?.code ?? "recommended"} maxLength={50} required />
          <FieldError id="code-error" message={errors.code} />
        </div>
        <div className="field">
          <label htmlFor="sortOrder">Порядок на головній</label>
          <input id="sortOrder" name="sortOrder" type="number" defaultValue={collection?.sortOrder ?? 1} />
        </div>
        <label className="consent">
          <input type="checkbox" name="isVisible" defaultChecked={collection?.isVisible ?? true} />
          <span>Показувати на головній</span>
        </label>
      </form>

      <CollectionsItems items={items} setItems={setItems} />
      <FieldError id="productIds-error" message={errors.productIds} />

      <form className="console-filters" role="search" onSubmit={search}>
        <div className="field">
          <label htmlFor="pick">Знайти товар</label>
          <input id="pick" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Назва або артикул" />
        </div>
        <button type="submit" className="btn btn--small btn--quiet">
          Знайти
        </button>
      </form>
      {found.length > 0 && (
        <ul className="pick-list">
          {found.map((item) => (
            <li key={item.id}>
              <span>
                {item.displayName ?? item.name} <span className="code muted">{item.sku}</span>
              </span>
              <button
                type="button"
                className="btn btn--small btn--quiet"
                disabled={items.some((x) => x.id === item.id) || items.length >= 24}
                onClick={() => setItems((list) => [...list, item])}
              >
                Додати
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="console-actions">
        <button type="submit" form="collection-form" className="btn btn--small" disabled={busy} aria-busy={busy}>
          Зберегти
        </button>
        {collection && (
          <button type="button" className="btn btn--small btn--quiet" onClick={remove}>
            Видалити
          </button>
        )}
        <button type="button" className="btn btn--small btn--quiet" onClick={onDone}>
          Скасувати
        </button>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
