import Link from "next/link";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { brandHref } from "../lib/brand-href";
import { ProductTabs } from "./product-tabs";

export function ProductDescription({ product }: { product: ProductDetails }) {
  const about = product.descriptionHtml ? (
    <div className="prose" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
  ) : (
    <p className="muted">Опис товару ще не додано.</p>
  );

  const specs = (
    <dl className="specs">
      <div>
        <dt>Артикул</dt>
        <dd className="code" translate="no">
          {product.sku}
        </dd>
      </div>
      <div>
        <dt>Розділ</dt>
        <dd>
          <Link href={`/catalog/${product.category.slug}`} className="link">
            {product.category.name}
          </Link>
        </dd>
      </div>
      {product.brand && (
        <div>
          <dt>Бренд</dt>
          <dd translate="no">
            <Link href={brandHref(product)} className="link">
              {product.brand}
            </Link>
          </dd>
        </div>
      )}
      {product.attributes.map((a, i) => (
        <div key={`${i}-${a.name}`}>
          <dt>{a.name}</dt>
          <dd>{a.value}</dd>
        </div>
      ))}
    </dl>
  );

  return (
    <section className="description" aria-label="Про товар">
      <ProductTabs
        label="Про товар"
        tabs={[
          { id: "about", label: "Опис", panel: about },
          { id: "specs", label: "Характеристики", panel: specs },
        ]}
      />
    </section>
  );
}
