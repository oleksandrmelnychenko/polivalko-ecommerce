"use client";

import { useState, type FormEvent } from "react";
import { withCsrf } from "@/shared/admin/csrf";
import { problemTitle, type Problem } from "@/shared/api/problem";
import { deleteImage, reorderImages, uploadProductImage } from "../api/client";
import type { Product } from "../lib/types";
import { ProductEditorAlt } from "./product-editor-alt";

export function ProductEditorImages({ product, onChange }: { product: Product; onChange: (p: Product) => void }) {
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
    const response = await uploadProductImage(product.id, data);
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
    const result = await withCsrf((headers) => reorderImages(headers, product.id, next));
    setBusy(false);
    if (result.data) onChange(result.data);
    else setError(problemTitle(result.error, "Порядок не збережено."));
  }

  async function remove(imageId: string) {
    setBusy(true);
    const result = await withCsrf((headers) => deleteImage(headers, product.id, imageId));
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
              <ProductEditorAlt
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
