"use client";

import { useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { StateBox } from "../../ui";
import { AdminOnly, CatalogTabs, FieldError, fieldErrors, mutate, problemTitle } from "../_shared";

type Category = components["schemas"]["AdminCategoryDto"];

/**
 * Розділи (розділи 4, 9 ТЗ): верхній рівень відповідає групам Navkolo, підрозділи створює
 * адміністратор. Зв'язок із групою Navkolo визначає, куди потрапляють нові товари під час імпорту.
 */
export default function AdminCategoriesPage() {
  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <AdminOnly>
        <Categories />
      </AdminOnly>
    </>
  );
}

function Categories() {
  const categories = useAdminData("admin-categories", () => browserApi.GET("/api/v1/admin/catalog/categories"));
  const [editing, setEditing] = useState<Category | "new" | null>(null);

  const list = categories.data ?? [];
  const top = list.filter((c) => !c.parentId);
  const ordered = top.flatMap((t) => [t, ...descendants(list, t.id, 1).map((c) => c)]);

  return (
    <StateBox state={categories}>
      <div className="admin-columns">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Розділ</th>
                <th scope="col">Група Navkolo</th>
                <th scope="col">Фільтри</th>
                <th scope="col" className="num">
                  Товарів
                </th>
                <th scope="col">
                  <span className="visually-hidden">Дія</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.id}>
                  <td style={{ paddingLeft: `calc(var(--space-sm) + ${depthOf(list, c) * 1.25}rem)` }}>
                    {c.name}
                    {!c.isVisible && <span className="muted"> (прихований)</span>}
                    <br />
                    <span className="code muted">/catalog/{c.slug}</span>
                  </td>
                  <td>{c.navkoloRef ?? <span className="muted">не задано</span>}</td>
                  <td>{c.filterAttributes.length ? c.filterAttributes.join(", ") : <span className="muted">успадковані</span>}</td>
                  <td className="num">{c.productCount}</td>
                  <td>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(c)}>
                      Змінити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-actions">
            <button type="button" className="btn btn--small" onClick={() => setEditing("new")}>
              Новий підрозділ
            </button>
          </div>
        </div>
        {editing && (
          <CategoryForm
            key={editing === "new" ? "new" : editing.id}
            category={editing === "new" ? null : editing}
            all={list}
            onDone={() => {
              setEditing(null);
              categories.reload();
            }}
          />
        )}
      </div>
    </StateBox>
  );
}

function descendants(all: Category[], parentId: string, depth: number): Category[] {
  return all.filter((c) => c.parentId === parentId).flatMap((c) => [c, ...descendants(all, c.id, depth + 1)]);
}

function depthOf(all: Category[], category: Category) {
  let depth = 0;
  for (let c: Category | undefined = category; c?.parentId; c = all.find((x) => x.id === c!.parentId)) depth++;
  return depth;
}

function CategoryForm({ category, all, onDone }: { category: Category | null; all: Category[]; onDone: () => void }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isTop = category !== null && !category.parentId;
  const names = useAdminData(`attr-names-${category?.id ?? "new"}`, () =>
    browserApi.GET("/api/v1/admin/catalog/attribute-names", { params: { query: { categoryId: category?.id } } }),
  );

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
    const result = await mutate((headers) =>
      category
        ? browserApi.PUT("/api/v1/admin/catalog/categories/{id}", { params: { path: { id: category.id } }, headers, body })
        : browserApi.POST("/api/v1/admin/catalog/categories", { headers, body }),
    );
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
    const result = await mutate((headers) =>
      browserApi.DELETE("/api/v1/admin/catalog/categories/{id}", { params: { path: { id: category.id } }, headers }),
    );
    setBusy(false);
    if (result.response.ok) onDone();
    else setError(problemTitle(result.error, "Розділ не видалено."));
  }

  return (
    <form className="admin-panel admin-form" onSubmit={submit} noValidate>
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
      <div className="admin-actions">
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
