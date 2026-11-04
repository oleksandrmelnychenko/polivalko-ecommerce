import { siteUrl } from "@/shared/site-url";
import { formatDateTime, formatMoney } from "@polivalko/shared/lib/format";
import type { Product } from "../lib/types";

export function ProductEditorNavkolo({ product }: { product: Product }) {
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
        <a href={siteUrl(`/product/${product.slug}`)} className="link" target="_blank" rel="noopener">
          Відкрити на сайті
        </a>
      </p>
    </aside>
  );
}
