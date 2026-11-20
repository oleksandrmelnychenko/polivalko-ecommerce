import Link from "next/link";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { brandHref } from "../lib/brand-href";

export function ProductDescription({ product }: { product: ProductDetails }) {
  const attributes = product.attributes.filter(({ name, value }) => {
    const label = name.trim().toLowerCase();
    return label !== "артикул dntrade" && (label !== "штрихкод" || value !== product.sku);
  });

  return (
    <div className="product-details" data-has-description={product.descriptionHtml ? "" : undefined}>
      {product.descriptionHtml && (
        <section className="product-details__description" aria-labelledby="product-description">
          <h2 id="product-description">Опис товару</h2>
          <div className="prose" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        </section>
      )}
      <section className="product-details__specs" aria-labelledby="product-specs">
        <h2 id="product-specs">Характеристики</h2>
        <dl className="specs">
          <div>
            <dt>Артикул</dt>
            <dd className="code" translate="no">{product.sku}</dd>
          </div>
          <div>
            <dt>Розділ</dt>
            <dd><Link href={`/catalog/${product.category.slug}`} className="link">{product.category.name}</Link></dd>
          </div>
          {product.brand && (
            <div>
              <dt>Бренд</dt>
              <dd translate="no"><Link href={brandHref(product)} className="link">{product.brand}</Link></dd>
            </div>
          )}
          {attributes.map((attribute, i) => (
            <div key={`${i}-${attribute.name}`}>
              <dt>{attribute.name}</dt>
              <dd>{attribute.value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
