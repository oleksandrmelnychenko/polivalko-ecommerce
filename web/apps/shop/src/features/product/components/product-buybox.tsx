import Link from "next/link";
import { Suspense } from "react";
import { BuyForm } from "@/features/cart";
import { discountPercent, ProductLabels, withoutSaleLabel } from "@/features/catalog";
import { canBuy, hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { FavoriteButton } from "@/features/favorites";
import { CompareButton } from "@/features/compare";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import type { DeliveryFacts } from "@/shared/lib/delivery-facts";
import { brandHref } from "../lib/brand-href";
import { displayAttributes } from "../lib/display-attributes";
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
  const priced = hasPrice(product.price);
  const buyable = canBuy(product);
  const highlights = displayAttributes(product).filter(({ name, value }) => {
    const label = name.trim().toLowerCase();
    return label !== "штрихкод" && label !== "одиниця виміру" && value.trim() && value.length <= 48;
  }).slice(0, 2);
  const tools = (
    <div className="buybox__tools">
      <FavoriteButton productId={product.id} variant="box" />
      <CompareButton product={{ id: product.id, name: product.name, slug: product.slug, sku: product.sku, price: product.price, inStock: product.inStock, brand: product.brand, imageUrl: product.images[0]?.url }} />
    </div>
  );

  return (
    <div className="buybox">
      <div className="buybox__top">
        {product.sku && <p className="buybox__sku" translate="no"><span>Артикул </span>{product.sku}</p>}
        <span className="product-stock-chip" data-available={product.inStock}>{product.inStock ? "В наявності" : "Немає в наявності"}</span>
      </div>
      <h1>{product.name}</h1>
      <ProductLabels labels={withoutSaleLabel(product.labels, Boolean(discount && product.oldPrice))} className="buybox__labels" />
      {product.brand && (
        <p className="buybox__meta">
          Бренд:{" "}
          <Link href={brandHref(product)} className="link" translate="no" title={`Усі товари ${product.brand} у розділі «${product.category.name}»`}>
            {product.brand}
          </Link>
        </p>
      )}
      {highlights.length > 0 && <dl className="buybox__highlights">
        {highlights.map(({ name, value }, index) => <div key={index}><dt>{name}</dt><dd>{value}</dd></div>)}
      </dl>}
      <div className="buybox__card">
        <div className="buybox__price-row">
          {discount && product.oldPrice && (
            <p className="buybox__was">
              <s className="price-old">
                <span className="visually-hidden">Стара ціна </span>
                <span className="money">{formatMoney(product.oldPrice)}</span>
              </s>
              <span className="product-discount-chip">−{discount}%</span>
            </p>
          )}

          <p className="buybox__price">
            {priced ? (
              <strong className={discount ? "price-sale" : undefined}><span className="money">{formatMoney(product.price)}</span></strong>
            ) : (
              <strong className="price-ask">{PRICE_ON_REQUEST}</strong>
            )}
          </p>
          {tools}
        </div>
        {product.variants.length > 1 && <ProductVariants variants={product.variants} />}
        {priced && (
          <BuyForm product={cartProduct} inStock={buyable} actionsClassName="buybox__actions" />
        )}
      </div>
      <a className="buybox__details link" href="#product-specs">Усі характеристики</a>
      <Suspense fallback={null}>
        <ProductDeliveryFacts load={deliveryFacts} />
      </Suspense>
    </div>
  );
}
