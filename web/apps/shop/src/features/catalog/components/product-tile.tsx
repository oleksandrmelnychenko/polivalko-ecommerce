import Link from "next/link";
import { AddToCart } from "@/features/cart";
import { FavoriteButton } from "@/features/favorites";
import type { ProductListItem } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { sized } from "@polivalko/shared/lib/images";
import { EyeIcon } from "@polivalko/shared/ui/icons";
import { toCartProduct } from "../lib/cart-product";
import { discountPercent } from "../lib/discount";
import { TileFlashes } from "./tile-flashes";

export function ProductTile({ product, priority }: { product: ProductListItem; priority?: boolean }) {
  const discount = discountPercent(product.price, product.oldPrice);
  const image = product.imageUrl ? sized(product.imageUrl, "(max-width: 40rem) 46vw, (max-width: 75rem) 30vw, 380px", 330) : null;
  const href = `/product/${product.slug}`;
  return (
    <li className="tile tile--product tile--shop">
      <figure className="tile__photo">
        {image ? (
          <img {...image} alt="" width={300} height={400} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? undefined : "low"} decoding="async" />
        ) : (
          <span className="tile__photo-empty">Фото додасть магазин</span>
        )}
        <TileFlashes product={product} discount={discount} />
        <span className="tile__bar">
          <Link href={href} className="round-btn" aria-label={`Переглянути: ${product.name}`} title="Переглянути">
            <EyeIcon />
          </Link>
          <FavoriteButton productId={product.id} name={product.name} />
        </span>
      </figure>
      <div className="tile__body">
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
        {product.brand && (
          <p className="tile__brand" translate="no">
            {product.brand}
          </p>
        )}
        <p className="tile__name">
          <Link href={href}>{product.name}</Link>
        </p>
        {!product.inStock && <p className="tile__stock tile__stock--out">Немає в наявності</p>}
        {product.inStock ? (
          <AddToCart product={toCartProduct(product)} inStock />
        ) : (
          <Link href={href} className="tile__buy tile__buy--off">
            Переглянути товар
          </Link>
        )}
      </div>
    </li>
  );
}
