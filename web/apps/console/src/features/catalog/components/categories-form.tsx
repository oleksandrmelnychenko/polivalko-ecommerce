"use client";

import { useState, type FormEvent } from "react";
import { withCsrf } from "@/shared/csrf";
import { FieldError } from "@/shared/form/field-error";
import { useConsoleData } from "@/shared/use-console-data";
import { fieldErrors, problemTitle } from "@polivalko/shared/api/problem";
import { deleteCategory, getAttributeNames, saveCategory } from "../api/client";
import type { ConsoleCategory } from "../lib/category-tree";

export function CategoriesForm({ category, all, onDone }: { category: ConsoleCategory | null; all: ConsoleCategory[]; onDone: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isTop = category !== null && !category.parentId;
  const names = useConsoleData(`attr-names-${category?.id ?? "new"}`, () => getAttributeNames(category?.id));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    const body = {
      parentId: isTop ? null : text("parentId"),
      name: text("name"),
      slug: text("slug"),
      sortOrder: Number(form.get("sortOrder")) || 0,
      isVisible: form.get("isVisible") === "on",
      navkoloRef: text("navkoloRef"),
      filterAttributes: String(form.get("filterAttributes") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      seoTitle: text("seoTitle"),
      seoDescription: text("seoDescription"),
    };
    setBusy(true);
    setError(null);
    const result = await withCsrf((headers) => saveCategory(headers, category ? category.id : null, body));
    setBusy(false);
    if (result.data) onDone();
    else {
      setErrors(fieldErrors(result.error));
      setError(problemTitle(result.error, "Не збережено."));
    }
  }

  async function remove() {
    if (!category) return;
    setBusy(true);
    const result = await withCsrf((headers) => deleteCategory(headers, category.id));
    setBusy(false);
    if (result.response.ok) onDone();
    else setError(problemTitle(result.error, "Розділ не видалено."));
  }

  return (
    <form className="console-panel console-form" onSubmit={submit} noValidate>
      <h2>{category ? `Розділ «${category.name}»` : "Новий підрозділ"}</h2>
      {!isTop && (
        <div className="field">
          <label htmlFor="parentId">Батьківський розділ</label>
          <select id="parentId" name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">Оберіть</option>
            {all
              .filter((c) => c.id !== category?.id)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <FieldError id="parentId-error" message={errors.parentId} />
        </div>
      )}
      <div className="field">
        <label htmlFor="name">Назва</label>
        <input id="name" name="name" defaultValue={category?.name} maxLength={200} required />
        <FieldError id="name-error" message={errors.name} />
      </div>
      <div className="field">
        <label htmlFor="slug">Адреса (порожньо — з назви)</label>
        <input id="slug" name="slug" defaultValue={category?.slug} maxLength={200} />
        <FieldError id="slug-error" message={errors.slug} />
      </div>
      <div className="field">
        <label htmlFor="navkoloRef">Група Navkolo</label>
        <input id="navkoloRef" name="navkoloRef" defaultValue={category?.navkoloRef ?? ""} maxLength={100} aria-describedby="navkolo-help" />
        <p id="navkolo-help" className="field__help">
          Нові товари цієї групи під час імпорту потрапляють у цей розділ.
        </p>
      </div>
      <div className="field">
        <label htmlFor="filterAttributes">Характеристики для фільтрів, через кому</label>
        <input id="filterAttributes" name="filterAttributes" defaultValue={category?.filterAttributes.join(", ")} aria-describedby="filters-help" />
        <p id="filters-help" className="field__help">
          {names.data && names.data.length > 0
            ? `У товарах розділу: ${names.data.slice(0, 12).map((n) => `${n.name} (${n.productCount})`).join(", ")}.`
            : "Порожньо — фільтри батьківського розділу."}
        </p>
        <FieldError id="filterAttributes-error" message={errors.filterAttributes} />
      </div>
      <div className="field">
        <label htmlFor="sortOrder">Порядок показу</label>
        <input id="sortOrder" name="sortOrder" type="number" defaultValue={category?.sortOrder ?? 0} />
      </div>
      <label className="consent">
        <input type="checkbox" name="isVisible" defaultChecked={category?.isVisible ?? true} />
        <span>Показувати на сайті</span>
      </label>
      <div className="field">
        <label htmlFor="seoTitle">SEO: заголовок</label>
        <input id="seoTitle" name="seoTitle" defaultValue={category?.seoTitle ?? ""} maxLength={200} />
      </div>
      <div className="field">
        <label htmlFor="seoDescription">SEO: опис</label>
        <input id="seoDescription" name="seoDescription" defaultValue={category?.seoDescription ?? ""} maxLength={500} />
      </div>
      <div className="console-actions">
        <button type="submit" className="btn btn--small" disabled={busy} aria-busy={busy}>
          Зберегти
        </button>
        {category && !isTop && (
          <button type="button" className="btn btn--small btn--quiet" disabled={busy} onClick={remove}>
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
    </form>
  );
}
