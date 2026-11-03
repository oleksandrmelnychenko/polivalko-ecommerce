"use client";

import { useState, type FormEvent } from "react";
import { withCsrf } from "@/shared/admin/csrf";
import { FieldError } from "@/shared/admin/form/field-error";
import { fieldErrors, problemTitle } from "@/shared/api/problem";
import type { CategoryNode } from "@/shared/api/types";
import { updateProduct } from "../api/client";
import { categoryOptions } from "../lib/category-options";
import type { Attribute, Product } from "../lib/types";
import { ProductEditorAttributes } from "./product-editor-attributes";

export function ProductEditorForm({ product, categories, onSaved }: { product: Product; categories: CategoryNode[]; onSaved: (p: Product) => void }) {
  const [attributes, setAttributes] = useState<Attribute[]>(product.attributes);
  const [description, setDescription] = useState(product.descriptionHtml ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const options = categoryOptions(categories);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    setBusy(true);
    setStatus(null);
    const result = await withCsrf((headers) =>
      updateProduct(headers, product.id, {
        displayName: text("displayName"),
        slug: text("slug"),
        categoryId: text("categoryId"),
        brand: text("brand"),
        descriptionHtml: description.trim() || null,
        isVisible: form.get("isVisible") === "on",
        seoTitle: text("seoTitle"),
        seoDescription: text("seoDescription"),
        attributes: attributes.filter((a) => a.name.trim() || a.value.trim()),
      }),
    );
    setBusy(false);
    if (result.data) {
      setErrors({});
      setStatus({ kind: "ok", text: "Збережено. Вітрина оновиться протягом хвилини." });
      onSaved(result.data);
    } else {
      setErrors(fieldErrors(result.error));
      setStatus({ kind: "error", text: problemTitle(result.error, "Не збережено.") });
    }
  }

  const describedBy = (name: string) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form className="admin-form" onSubmit={submit} noValidate>
      <h1 className="admin-title" style={{ marginBottom: 0 }}>
        {product.displayName ?? product.navkolo.name}
      </h1>
      {status && (
        <p className={status.kind === "ok" ? "notice" : "notice notice--error"} role={status.kind === "ok" ? "status" : "alert"}>
          {status.text}
        </p>
      )}

      <div className="fields-2">
        <div className="field">
          <label htmlFor="displayName">Назва на вітрині</label>
          <input id="displayName" name="displayName" defaultValue={product.displayName ?? ""} placeholder={product.navkolo.name} maxLength={500} aria-describedby={describedBy("displayName")} />
          <FieldError id="displayName-error" message={errors.displayName} />
        </div>
        <div className="field">
          <label htmlFor="slug">Адреса сторінки</label>
          <input id="slug" name="slug" defaultValue={product.slug} maxLength={300} aria-describedby={describedBy("slug") ?? "slug-help"} />
          <p id="slug-help" className="field__help">
            Після зміни стара адреса перенаправлятиме на нову.
          </p>
          <FieldError id="slug-error" message={errors.slug} />
        </div>
      </div>

      <div className="fields-2">
        <div className="field">
          <label htmlFor="categoryId">Розділ на сайті</label>
          <select id="categoryId" name="categoryId" defaultValue={product.categoryId} aria-describedby={describedBy("categoryId")}>
            {!options.some((o) => o.id === product.categoryId) && <option value={product.categoryId}>Поточний (прихований) розділ</option>}
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <FieldError id="categoryId-error" message={errors.categoryId} />
        </div>
        <div className="field">
          <label htmlFor="brand">Бренд</label>
          <input id="brand" name="brand" defaultValue={product.brand ?? ""} maxLength={200} />
        </div>
      </div>

      <label className="consent">
        <input type="checkbox" name="isVisible" defaultChecked={product.isVisible} />
        <span>Показувати на сайті</span>
      </label>

      <div className="field">
        <label htmlFor="description">Опис (HTML: абзаци, списки, заголовки, таблиці, посилання)</label>
        <textarea
          id="description"
          className="code-area"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-describedby={describedBy("descriptionHtml") ?? "description-help"}
        />
        <p id="description-help" className="field__help">
          Скрипти, стилі й вбудовані фото сервер прибирає під час збереження.
        </p>
        <FieldError id="descriptionHtml-error" message={errors.descriptionHtml} />
      </div>
      {description.trim() && (
        <details>
          <summary>Попередній перегляд</summary>
          <iframe title="Попередній перегляд опису" sandbox="" srcDoc={description} style={{ width: "100%", minHeight: "12rem", border: "1px solid var(--color-rule)" }} />
        </details>
      )}

      <ProductEditorAttributes attributes={attributes} setAttributes={setAttributes} error={errors.attributes} />

      <div className="fields-2">
        <div className="field">
          <label htmlFor="seoTitle">SEO: заголовок</label>
          <input id="seoTitle" name="seoTitle" defaultValue={product.seoTitle ?? ""} maxLength={200} placeholder="Як назва на вітрині" />
          <FieldError id="seoTitle-error" message={errors.seoTitle} />
        </div>
        <div className="field">
          <label htmlFor="seoDescription">SEO: опис</label>
          <input id="seoDescription" name="seoDescription" defaultValue={product.seoDescription ?? ""} maxLength={500} placeholder="Перші речення опису" />
          <FieldError id="seoDescription-error" message={errors.seoDescription} />
        </div>
      </div>

      <div className="admin-actions">
        <button type="submit" className="btn btn--small" disabled={busy} aria-busy={busy}>
          Зберегти
        </button>
      </div>
    </form>
  );
}
