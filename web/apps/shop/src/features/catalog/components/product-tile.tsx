import Link from "next/link";
import { AddToCart } from "@/features/cart";
import { FavoriteButton } from "@/features/favorites";
import { CompareButton } from "@/features/compare";
import type { ProductListItem } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { sized } from "@polivalko/shared/lib/images";
import { CircleCheckIcon } from "@polivalko/shared/ui/icons";
import { toCartProduct } from "../lib/cart-product";
import { discountPercent } from "../lib/discount";
import { canBuy, hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { TileFlashes } from "./tile-flashes";

export function ProductTile({ product, priority }: { product: ProductListItem; priority?: boolean }) {
  const discount = discountPercent(product.price, product.oldPrice);
  const buyable = canBuy(product);
  const image = product.imageUrl ? sized(product.imageUrl, "(max-width: 48rem) 46vw, (max-width: 80rem) 30vw, 320px", 330) : null;
  const href = `/product/${product.slug}`;
  return (
    <li className="tile tile--product tile--shop">
      <figure className="tile__photo">
        {image ? (
          <span className="tile__image">
            <img {...image} alt="" width={320} height={336} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? undefined : "low"} decoding="async" />
          </span>
        ) : (
          <span className="tile__photo-empty">Фото відсутнє</span>
        )}
        <TileFlashes product={product} discount={discount} />
        <div className="tile__bar">
          <FavoriteButton productId={product.id} name={product.name} />
          <CompareButton product={product} />
        </div>
      </figure>
      <div className="tile__body">
        <p className="tile__name">
          <Link href={href}>{product.name}</Link>
        </p>
        {buyable ? (
          <p className="tile__stock">
            <CircleCheckIcon />
            В наявності
          </p>
        ) : (
          <p className="tile__stock tile__stock--out">Немає в наявності</p>
        )}
        {hasPrice(product.price) ? (
          <p className="tile__price">
            <strong className={discount ? "price-sale" : undefined}>
              {discount && <span className="visually-hidden">Нова ціна </span>}
              <span className="money">{formatMoney(product.price)}</span>
            </strong>
            {product.oldPrice && discount && (
              <s className="price-old">
                <span className="visually-hidden">Стара ціна </span>
                <span className="money">{formatMoney(product.oldPrice)}</span>
              </s>
            )}
          </p>
        ) : (
          <p className="tile__price">
            <strong className="price-ask">{PRICE_ON_REQUEST}</strong>
          </p>
        )}
        {buyable ? (
          <AddToCart product={toCartProduct(product)} inStock />
        ) : (
          <Link href={href} className="tile__buy tile__buy--off">
            Переглянути
          </Link>
        )}
      </div>
    </li>
  );
}
