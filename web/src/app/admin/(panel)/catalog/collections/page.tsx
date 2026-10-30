"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { formatMoney } from "@/lib/format";
import { StateBox } from "../../ui";
import { CatalogTabs, FieldError, fieldErrors, mutate, problemTitle } from "../_shared";

type Collection = components["schemas"]["AdminCollectionDto"];
type Item = components["schemas"]["AdminProductListItemDto"];

/** Редакційні добірки головної (розділ 9 ТЗ): назва, порядок, видимість і товари в потрібному порядку. */
export default function AdminCollectionsPage() {
  const collections = useAdminData("collections", () => browserApi.GET("/api/v1/admin/catalog/collections"));
  const [editing, setEditing] = useState<Collection | "new" | null>(null);

  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <StateBox state={collections}>
        <div className="admin-columns">
          <div>
            {(collections.data ?? []).length === 0 && <p className="muted">Добірок ще немає. Головна покаже лише розділи й знижки.</p>}
            <ul className="pick-list" style={{ maxHeight: "none" }}>
              {(collections.data ?? []).map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>{c.title}</strong> <span className="code muted">{c.code}</span>
                    <br />
                    <span className="muted">
                      {c.products.length} товарів{c.isVisible ? "" : ", прихована"}
                    </span>
                  </span>
                  <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(c)}>
                    Змінити
                  </button>
                </li>
              ))}
            </ul>
            <div className="admin-actions">
              <button type="button" className="btn btn--small" onClick={() => setEditing("new")}>
                Нова добірка
              </button>
            </div>
          </div>
          {editing && (
            <CollectionForm
              key={editing === "new" ? "new" : editing.id}
              collection={editing === "new" ? null : editing}
              onDone={() => {
                setEditing(null);
                collections.reload();
              }}
            />
          )}
        </div>
      </StateBox>
    </>
  );
}

function CollectionForm({ collection, onDone }: { collection: Collection | null; onDone: () => void }) {
  const [items, setItems] = useState<Item[]>(collection?.products ?? []);
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<Item[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search(event: FormEvent) {
    event.preventDefault();
    const { data } = await browserApi.GET("/api/v1/admin/catalog/products", { params: { query: { q: query.trim() || undefined, visible: true, pageSize: 20 } } });
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
    const result = await mutate((headers) =>
      collection
        ? browserApi.PUT("/api/v1/admin/catalog/collections/{id}", { params: { path: { id: collection.id } }, headers, body })
        : browserApi.POST("/api/v1/admin/catalog/collections", { headers, body }),
    );
    setBusy(false);
    if (result.data) onDone();
    else {
      setErrors(fieldErrors(result.error));
      setError(problemTitle(result.error, "Не збережено."));
    }
  }

  async function remove() {
    if (!collection) return;
    const result = await mutate((headers) =>
      browserApi.DELETE("/api/v1/admin/catalog/collections/{id}", { params: { path: { id: collection.id } }, headers }),
    );
    if (result.response.ok) onDone();
    else setError(problemTitle(result.error, "Добірку не видалено."));
  }

  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  return (
    <div className="admin-panel admin-form">
      <form className="admin-form" id="collection-form" onSubmit={submit} noValidate>
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

      <h3>Товари ({items.length} з 24)</h3>
      {items.length > 0 ? (
        <ol className="pick-list">
          {items.map((item, i) => (
            <li key={item.id}>
              <span>
                {item.displayName ?? item.name} <span className="muted">{formatMoney(item.price)}</span>
                {!item.isVisible && <span className="muted"> (прихований, на головній не з&apos;явиться)</span>}
              </span>
              <span className="row" style={{ display: "flex", gap: "var(--space-3xs)" }}>
                <button type="button" className="btn btn--small btn--quiet" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Вище: ${item.name}`}>
                  ↑
                </button>
                <button type="button" className="btn btn--small btn--quiet" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Нижче: ${item.name}`}>
                  ↓
                </button>
                <button type="button" className="btn btn--small btn--quiet" onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))} aria-label={`Прибрати: ${item.name}`}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Додайте товари пошуком нижче.</p>
      )}
      <FieldError id="productIds-error" message={errors.productIds} />

      <form className="admin-filters" role="search" onSubmit={search}>
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

      <div className="admin-actions">
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
