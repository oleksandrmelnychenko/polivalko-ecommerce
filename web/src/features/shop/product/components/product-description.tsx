import Link from "next/link";
import type { ProductDetails } from "@/shared/api/types";

export function ProductDescription({ product }: { product: ProductDetails }) {
  return (
    <section className="description" aria-labelledby="about-title">
      <div>
        <h2 id="about-title">Опис</h2>
        {product.descriptionHtml ? (
          <div className="prose" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
        ) : (
          <p className="muted">Опис додасть магазин.</p>
        )}
      </div>
      <div>
        <h2 id="specs-title">Характеристики</h2>
        <dl className="specs" aria-labelledby="specs-title">
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
              <dd translate="no">{product.brand}</dd>
            </div>
          )}
          {product.attributes.map((a) => (
            <div key={a.name}>
              <dt>{a.name}</dt>
              <dd>{a.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
