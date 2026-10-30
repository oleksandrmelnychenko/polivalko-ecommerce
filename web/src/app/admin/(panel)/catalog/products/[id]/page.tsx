"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { browserApi, type Problem } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { csrfHeader, forgetCsrf, useAdminData } from "@/lib/admin";
import { formatDateTime, formatMoney } from "@/lib/format";
import { StateBox } from "../../../ui";
import { CatalogTabs, FieldError, fieldErrors, mutate, problemTitle } from "../../_shared";

type Product = components["schemas"]["AdminProductDto"];
type Attribute = components["schemas"]["ProductAttributeDto"];

export default function AdminProductPage() {
  const { id } = useParams<{ id: string }>();
  const product = useAdminData(id, () => browserApi.GET("/api/v1/admin/catalog/products/{id}", { params: { path: { id } } }));
  const categories = useAdminData("categories-tree", () => browserApi.GET("/api/v1/categories"));

  return (
    <>
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/admin/catalog">Каталог</Link>
          </li>
          <li aria-current="page">{product.data?.displayName ?? product.data?.navkolo.name ?? "Товар"}</li>
        </ol>
      </nav>
      <CatalogTabs />
      <StateBox state={product}>
        {product.data && (
          <div className="admin-columns">
            <div>
              <ProductForm key={product.data.updatedAt} product={product.data} categories={categories.data ?? []} onSaved={product.setData} />
              <Images product={product.data} onChange={product.setData} />
            </div>
            <NavkoloFields product={product.data} />
          </div>
        )}
      </StateBox>
    </>
  );
}

/** Поля Navkolo видно, але змінити їх на сайті неможливо (розділ 9 ТЗ). */
function NavkoloFields({ product }: { product: Product }) {
  const n = product.navkolo;
  return (
    <aside className="readonly" aria-labelledby="navkolo-title">
      <h2 id="navkolo-title">З Navkolo</h2>
      <p className="field__help" style={{ marginBottom: "var(--space-sm)" }}>
        Ці поля оновлює синхронізація з обліком. На сайті вони не редагуються.
      </p>
      <dl>
        <dt>Артикул</dt>
        <dd className="code">{n.sku}</dd>
        <dt>Назва в обліку</dt>
        <dd>{n.name}</dd>
        <dt>Ціна</dt>
        <dd>
          {formatMoney(n.price)}
          {n.oldPrice && <s className="muted"> {formatMoney(n.oldPrice)}</s>}
        </dd>
        <dt>Залишок</dt>
        <dd>{n.stock}</dd>
        <dt>Група</dt>
        <dd>{n.groupRef ?? "не задано"}</dd>
        {n.variantGroup && (
          <>
            <dt>Варіант</dt>
            <dd>
              {n.variantLabel ?? "без підпису"} <span className="muted">({n.variantGroup})</span>
            </dd>
          </>
        )}
        <dt>Ціну оновлено</dt>
        <dd>{formatDateTime(n.priceUpdatedAt)}</dd>
        <dt>Ідентифікатор</dt>
        <dd className="code">{n.navkoloId}</dd>
      </dl>
      <p style={{ marginTop: "var(--space-md)" }}>
        <a href={`/product/${product.slug}`} className="link" target="_blank" rel="noopener">
          Відкрити на сайті
        </a>
      </p>
    </aside>
  );
}

function ProductForm({
  product,
  categories,
  onSaved,
}: {
  product: Product;
  categories: components["schemas"]["CategoryNodeDto"][];
  onSaved: (p: Product) => void;
}) {
  const [attributes, setAttributes] = useState<Attribute[]>(product.attributes);
  const [description, setDescription] = useState(product.descriptionHtml ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const options: { id: string; name: string }[] = [];
  const walk = (nodes: typeof categories, depth: number) =>
    nodes.forEach((n) => {
      options.push({ id: n.id, name: `${"— ".repeat(depth)}${n.name}` });
      walk(n.children, depth + 1);
    });
  walk(categories, 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (name: string) => String(form.get(name) ?? "").trim() || null;
    setBusy(true);
    setStatus(null);
    const result = await mutate((headers) =>
      browserApi.PUT("/api/v1/admin/catalog/products/{id}", {
        params: { path: { id: product.id } },
        headers,
        body: {
          displayName: text("displayName"),
          slug: text("slug"),
          categoryId: text("categoryId"),
          brand: text("brand"),
          descriptionHtml: description.trim() || null,
          isVisible: form.get("isVisible") === "on",
          seoTitle: text("seoTitle"),
          seoDescription: text("seoDescription"),
          attributes: attributes.filter((a) => a.name.trim() || a.value.trim()),
        },
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
          {/* Незбережений HTML показуємо в ізольованому фреймі без скриптів. */}
          <iframe title="Попередній перегляд опису" sandbox="" srcDoc={description} style={{ width: "100%", minHeight: "12rem", border: "1px solid var(--color-rule)" }} />
        </details>
      )}

      <fieldset className="admin-form" style={{ border: 0, padding: 0 }}>
        <legend className="admin-title" style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-xs)" }}>
          Характеристики
        </legend>
        <p className="field__help">Фільтри розділу будуються за назвами, погодженими в налаштуваннях розділу.</p>
        {attributes.map((a, i) => (
          <div key={i} className="attr-row">
            <div className="field">
              <label htmlFor={`attr-name-${i}`}>Назва</label>
              <input id={`attr-name-${i}`} value={a.name} maxLength={100} onChange={(e) => setAttributes((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            </div>
            <div className="field">
              <label htmlFor={`attr-value-${i}`}>Значення</label>
              <input id={`attr-value-${i}`} value={a.value} maxLength={300} onChange={(e) => setAttributes((list) => list.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            </div>
            <button type="button" className="btn btn--small btn--quiet" onClick={() => setAttributes((list) => list.filter((_, j) => j !== i))}>
              Прибрати
            </button>
          </div>
        ))}
        <FieldError id="attributes-error" message={errors.attributes} />
        <div>
          <button type="button" className="btn btn--small btn--quiet" onClick={() => setAttributes((list) => [...list, { name: "", value: "" }])}>
            Додати характеристику
          </button>
        </div>
      </fieldset>

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

/** Фото товару: завантаження, порядок, підпис alt і видалення. */
function Images({ product, onChange }: { product: Product; onChange: (p: Product) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const images = product.images;

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const data = new FormData(formElement);
    if (!(data.get("file") instanceof File) || (data.get("file") as File).size === 0) {
      setError("Оберіть файл фото.");
      return;
    }
    setBusy(true);
    setError(null);
    const send = async () =>
      fetch(`/api/v1/admin/catalog/products/${product.id}/images`, { method: "POST", body: data, headers: await csrfHeader() });
    let response = await send();
    if (response.status === 400) {
      const problem = (await response.clone().json().catch(() => null)) as Problem | null;
      if (problem?.code === "auth.csrf_invalid") {
        forgetCsrf();
        response = await send();
      }
    }
    setBusy(false);
    if (response.ok) {
      formElement.reset();
      onChange((await response.json()) as Product);
    } else {
      const problem = (await response.json().catch(() => null)) as Problem | null;
      setError(problem?.errors?.file?.[0] ?? problem?.title ?? "Фото не завантажено.");
    }
  }

  async function reorder(next: { id: string; alt: string }[]) {
    setBusy(true);
    const result = await mutate((headers) =>
      browserApi.PUT("/api/v1/admin/catalog/products/{id}/images", {
        params: { path: { id: product.id } },
        headers,
        body: { images: next },
      }),
    );
    setBusy(false);
    if (result.data) onChange(result.data);
    else setError(problemTitle(result.error, "Порядок не збережено."));
  }

  async function remove(imageId: string) {
    setBusy(true);
    const result = await mutate((headers) =>
      browserApi.DELETE("/api/v1/admin/catalog/products/{id}/images/{imageId}", {
        params: { path: { id: product.id, imageId } },
        headers,
      }),
    );
    setBusy(false);
    if (result.data) onChange(result.data);
    else setError(problemTitle(result.error, "Фото не видалено."));
  }

  const move = (index: number, delta: number) => {
    const list = images.map((i) => ({ id: i.id, alt: i.alt }));
    const [item] = list.splice(index, 1);
    list.splice(index + delta, 0, item);
    void reorder(list);
  };

  return (
    <section className="admin-subsection" aria-labelledby="images-title">
      <h2 id="images-title">Фото</h2>
      {images.length > 0 ? (
        <ul className="images">
          {images.map((image, i) => (
            <li key={image.id}>
              <img src={image.url} alt={image.alt} loading="lazy" />
              <AltEditor
                value={image.alt}
                onSave={(alt) => reorder(images.map((x) => ({ id: x.id, alt: x.id === image.id ? alt : x.alt })))}
                disabled={busy}
                id={image.id}
              />
              <div className="row">
                <button type="button" className="btn btn--small btn--quiet" disabled={busy || i === 0} onClick={() => move(i, -1)}>
                  Раніше
                </button>
                <button type="button" className="btn btn--small btn--quiet" disabled={busy || i === images.length - 1} onClick={() => move(i, 1)}>
                  Пізніше
                </button>
                <button type="button" className="btn btn--small btn--quiet" disabled={busy} onClick={() => remove(image.id)}>
                  Видалити
                </button>
              </div>
              {i === 0 && <span className="muted">Головне фото</span>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">Фото ще немає: на вітрині показується «Фото додасть магазин».</p>
      )}
      <form className="admin-filters" style={{ marginTop: "var(--space-md)" }} onSubmit={upload}>
        <div className="field">
          <label htmlFor="file">Нове фото (JPEG, PNG, WebP до 10 МБ)</label>
          <input id="file" name="file" type="file" accept="image/jpeg,image/png,image/webp" />
        </div>
        <div className="field">
          <label htmlFor="alt">Опис фото для незрячих</label>
          <input id="alt" name="alt" maxLength={300} placeholder="Що на фото" />
        </div>
        <button type="submit" className="btn btn--small" disabled={busy} aria-busy={busy}>
          Завантажити
        </button>
      </form>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function AltEditor({ id, value, onSave, disabled }: { id: string; value: string; onSave: (alt: string) => void; disabled: boolean }) {
  const [text, setText] = useState(value);
  return (
    <div className="field">
      <label htmlFor={`alt-${id}`} className="visually-hidden">
        Опис фото
      </label>
      <input id={`alt-${id}`} value={text} maxLength={300} onChange={(e) => setText(e.target.value)} onBlur={() => text.trim() && text !== value && onSave(text.trim())} disabled={disabled} />
    </div>
  );
}
