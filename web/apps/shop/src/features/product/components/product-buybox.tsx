import Link from "next/link";
import { Suspense } from "react";
import { BuyForm } from "@/features/cart";
import { discountPercent, ProductLabels, withoutSaleLabel } from "@/features/catalog";
import { FavoriteButton } from "@/features/favorites";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import type { DeliveryFacts } from "@/shared/lib/delivery-facts";
import { brandHref } from "../lib/brand-href";
import { ProductDeliveryFacts } from "./product-delivery-facts";
import { ProductVariants } from "./product-variants";

export function ProductBuybox({ product, deliveryFacts }: { product: ProductDetails; deliveryFacts: () => Promise<DeliveryFacts | null> }) {
  const cartProduct = {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price.value,
    imageUrl: product.images[0]?.url ?? null,
  };
  const discount = discountPercent(product.price, product.oldPrice);

  return (
    <div className="buybox">
      <ProductLabels labels={withoutSaleLabel(product.labels, Boolean(discount && product.oldPrice))} className="buybox__labels" />
      <h1>{product.name}</h1>
      <p className="buybox__meta">
        <span>
          Артикул:{" "}
          <span className="code" translate="no">
            {product.sku}
          </span>
        </span>
        {product.brand && (
          <span>
            Бренд:{" "}
            <Link href={brandHref(product)} className="link" translate="no" title={`Усі товари ${product.brand} у розділі «${product.category.name}»`}>
              {product.brand}
            </Link>
          </span>
        )}
      </p>
      <div className="buybox__card">
        <div>
          {discount && product.oldPrice && (
            <p className="buybox__was">
              <s className="price-old">
                <span className="visually-hidden">Стара ціна </span>
                <span className="money">{formatMoney(product.oldPrice)}</span>
              </s>
              <span className="flag flag--sale">−{discount}%</span>
            </p>
          )}
          <p className="buybox__price">
            <strong className={discount ? "price-sale" : undefined}><span className="money">{formatMoney(product.price)}</span></strong>
          </p>
          <p className={product.inStock ? "stock stock--in" : "stock stock--out"}>{product.inStock ? "В наявності" : "Немає в наявності"}</p>
        </div>
        {product.variants.length > 1 && <ProductVariants variants={product.variants} />}
        <BuyForm product={cartProduct} inStock={product.inStock} actionsClassName="buybox__actions" aside={<FavoriteButton productId={product.id} variant="box" />} />
      </div>
      {product.attributes.length > 0 && <a className="buybox__details link" href="#product-specs">Характеристики товару</a>}
      <Suspense fallback={null}>
        <ProductDeliveryFacts load={deliveryFacts} />
      </Suspense>
    </div>
  );
}
