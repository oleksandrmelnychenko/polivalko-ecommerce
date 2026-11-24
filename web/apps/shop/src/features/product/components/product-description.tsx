import Link from "next/link";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { brandHref } from "../lib/brand-href";
import { displayAttributes } from "../lib/display-attributes";

export function ProductDescription({ product }: { product: ProductDetails }) {
  if (!product.descriptionHtml) return null;
  return (
    <div className="prose" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
  );
}

export function ProductSpecs({ product }: { product: ProductDetails }) {
  const attributes = displayAttributes(product);
  return (
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
  );
}
