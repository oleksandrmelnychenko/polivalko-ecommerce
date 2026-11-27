import Link from "@/shared/ui/idle-link";
import { AddToCart } from "@/features/cart";
import { FavoriteButton } from "@/features/favorites";
import { CompareButton } from "@/features/compare";
import type { ProductListItem } from "@polivalko/shared/api/types";
import { formatMoney, plural } from "@polivalko/shared/lib/format";
import { sized } from "@/shared/lib/images";
import { toCartProduct } from "../lib/cart-product";
import { discountPercent } from "../lib/discount";
import { canBuy, hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { LiveAvailability } from "@/shared/ui/live-availability";
import { withoutSaleLabel } from "../lib/labels";
import { ProductLabels } from "./product-labels";

export function ProductTile({ product, priority }: { product: ProductListItem; priority?: boolean }) {
  const discount = discountPercent(product.price, product.oldPrice);
  const showDiscount = product.inStock && discount !== null;
  const buyable = canBuy(product);
  const image = product.imageUrl ? sized(product.imageUrl, "(max-width: 48rem) 46vw, (max-width: 80rem) 30vw, 320px", 330) : null;
  const href = `/product/${product.slug}`;
  // A pack group is one card in a listing; the size is picked on the product page.
  const packs = product.packSizes ?? 0;
  const priceFrom = packs > 1 && product.priceFrom?.value === product.price.value;
  return (
    <li className="tile tile--product tile--shop" data-sku={product.sku}>
      <figure className="tile__photo">
        {image ? (
          <span className="tile__image">
            <img {...image} alt={product.name} width={320} height={240} loading={priority ? "eager" : "lazy"} fetchPriority={priority ? undefined : "low"} decoding="async" />
          </span>
        ) : (
          <span className="tile__photo-empty">Фото відсутнє</span>
        )}
        <ProductLabels labels={withoutSaleLabel(product.labels, showDiscount)} className="tile__flashes" />
        <div className="tile__bar">
          <FavoriteButton productId={product.id} name={product.name} />
          <CompareButton product={product} />
        </div>
      </figure>
      <div className="tile__body">
        <div className="tile__info-row">
          {product.sku && <span className="tile__sku" translate="no"><span className="visually-hidden">Артикул </span>{product.sku}</span>}
          <LiveAvailability productId={product.id} inStock={product.inStock} className="tile__availability" />
        </div>
        <p className="tile__name">
          <Link href={href}>{product.name}</Link>
        </p>
        {packs > 1 && <p className="tile__packs">{packs} {plural(packs, "фасування", "фасування", "фасувань")}</p>}
        {hasPrice(product.price) ? (
          <p className="tile__price">
            <strong className={discount ? "price-sale" : undefined}>
              {discount && <span className="visually-hidden">Нова ціна </span>}
              {priceFrom && "від "}
              <span className="money">{formatMoney(product.price)}</span>
            </strong>
            {product.oldPrice && discount && (
              <span className="tile__price-history">
                <s className="price-old">
                  <span className="visually-hidden">Стара ціна </span>
                  <span className="money">{formatMoney(product.oldPrice)}</span>
                </s>
                {showDiscount && <span className="tile__discount">−{discount}%</span>}
              </span>
            )}
          </p>
        ) : (
          <p className="tile__price">
            <strong className="price-ask">{PRICE_ON_REQUEST}</strong>
          </p>
        )}
        {packs > 1 ? (
          <Link href={href} className="tile__buy">
            Обрати фасування
          </Link>
        ) : hasPrice(product.price) ? (
          // The live stock may differ from the page's: sold out since, the card offers the product page instead.
          <AddToCart
            product={toCartProduct(product)}
            inStock={buyable}
            fallback={<Link href={href} className="tile__buy tile__buy--off">Переглянути</Link>}
          />
        ) : (
          <Link href={href} className="tile__buy tile__buy--off">
            Переглянути
          </Link>
        )}
      </div>
    </li>
  );
}
