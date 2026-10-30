import Link from "next/link";
import type { Money, ProductListItem } from "@/lib/api/server";
import { formatMoney } from "@/lib/format";
import { sized } from "@/lib/images";
import { AddToCart } from "./add-to-cart";
import { EyeIcon } from "./icons";

export function toCartProduct(p: ProductListItem) {
  return { productId: p.id, name: p.name, slug: p.slug, sku: p.sku, price: p.price.value, imageUrl: p.imageUrl ?? null };
}

/** Знижка у відсотках лише за коректних даних обліку: стара ціна більша за поточну. */
export function discountPercent(price: Money, oldPrice?: Money | null): number | null {
  if (!oldPrice) return null;
  const now = Number(price.value);
  const before = Number(oldPrice.value);
  if (!(before > now) || now <= 0) return null;
  const percent = Math.round((1 - now / before) * 100);
  return percent > 0 ? percent : null;
}

/**
 * Сірий товарний блок 3:4 (розділ 3 ТЗ) як у референсі: фото, діагональні стрічки на кутах (ліворуч —
 * знижка або «немає», праворуч — «акція»). Звичайна плитка — як у магазині теми Sofani: ціна ліворуч, бренд
 * праворуч, назва Ubuntu під ними; при наведенні картка піднімається з тінню, по центру фото — жовтий «+»,
 * знизу виїжджає біла смуга дій («Переглянути», «У кошик»), назва жовтіє. `look` — плитка лукбук-секцій
 * головної, як «product-style_3»: фото темнішає й збільшується, ціна виїжджає зверху ліворуч, назва — знизу,
 * по центру круглі кнопки. На сенсорних екранах смуга дій стоїть під фото.
 */
export function ProductTile({ product, priority, look }: { product: ProductListItem; priority?: boolean; look?: boolean }) {
  const discount = discountPercent(product.price, product.oldPrice);
  const image = product.imageUrl ? sized(product.imageUrl, "(max-width: 40rem) 46vw, (max-width: 75rem) 30vw, 380px", 330) : null;
  const href = `/product/${product.slug}`;
  return (
    <li className={look ? "tile tile--product tile--look" : "tile tile--product tile--shop"}>
      {look && <Link href={href} className="tile__cover" tabIndex={-1} aria-hidden="true" />}
      <figure className="tile__photo">
        {image ? (
          <img {...image} alt="" width={300} height={400} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? undefined : "low"} decoding="async" />
        ) : (
          <span className="tile__photo-empty">Фото додасть магазин</span>
        )}
        <span className="tile__flashes">
          {!product.inStock ? <span className="flash">Немає</span> : discount && <span className="flash">−{discount}%</span>}
          {discount && (
            <span className="flash flash--right flash--sale" aria-hidden="true">
              Акція
            </span>
          )}
        </span>
        {!look && (
          <>
            <span className="tile__sign" aria-hidden="true" />
            <span className="tile__bar">
              <Link href={href} className="round-btn" aria-label={`Переглянути: ${product.name}`} title="Переглянути">
                <EyeIcon />
              </Link>
              <AddToCart product={toCartProduct(product)} inStock={product.inStock} round />
            </span>
          </>
        )}
      </figure>
      <div className="tile__body">
        {look && (
          <p className="tile__name">
            <Link href={href}>{product.name}</Link>
          </p>
        )}
        <p className="tile__price">
          {product.oldPrice && discount && (
            <s className="price-old">
              <span className="visually-hidden">Стара ціна </span>
              {formatMoney(product.oldPrice)}
            </s>
          )}
          <strong className={discount ? "price-sale" : undefined}>
            {discount && <span className="visually-hidden">Нова ціна </span>}
            {formatMoney(product.price)}
          </strong>
        </p>
        {look ? (
          <div className="tile__actions">
            <Link href={href} className="round-btn" aria-label={`Переглянути: ${product.name}`}>
              <EyeIcon />
            </Link>
            <AddToCart product={toCartProduct(product)} inStock={product.inStock} round />
          </div>
        ) : (
          <>
            {product.brand && (
              <p className="tile__brand" translate="no">
                {product.brand}
              </p>
            )}
            <p className="tile__name">
              <Link href={href}>{product.name}</Link>
            </p>
          </>
        )}
      </div>
    </li>
  );
}

/** `priority` — лише для сітки на першому екрані (каталог, пошук): перші фото вантажаться одразу. */
export function ProductTiles({ products, columns, priority, look }: { products: ProductListItem[]; columns?: 2 | 3; priority?: boolean; look?: boolean }) {
  return (
    <ul className={columns ? `tiles tiles--${columns}` : "tiles"}>
      {products.map((product, i) => (
        <ProductTile key={product.id} product={product} priority={priority && i < 3} look={look} />
      ))}
    </ul>
  );
}

export function ProductTilesSkeleton({ count = 8 }: { count?: number }) {
  return (
    <ul className="tiles" aria-busy="true" aria-label="Завантаження товарів…">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="tile">
          <div className="tile__photo skeleton" />
          <div className="tile__body">
            <div className="skeleton" style={{ height: "var(--space-lg)" }} />
            <div className="skeleton" style={{ height: "var(--space-xl)", width: "50%", marginInline: "auto" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
