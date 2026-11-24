import Link from "next/link";
import { BuyForm } from "@/features/cart";
import { canBuy, hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { FavoriteButton } from "@/features/favorites";
import { CompareButton } from "@/features/compare";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { brandHref } from "../lib/brand-href";
import { ProductVariants } from "./product-variants";
import { CopySkuTag } from "./copy-sku-tag";
import { ChevronRightIcon } from "@polivalko/shared/ui/icons";

export function ProductBuybox({ product, discount }: { product: ProductDetails; discount: number | null }) {
  const cartProduct = {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price.value,
    imageUrl: product.images[0]?.url ?? null,
  };
  const priced = hasPrice(product.price);
  const buyable = canBuy(product);
  const tools = (
    <div className="buybox__tools">
      <FavoriteButton productId={product.id} variant="box" />
      <CompareButton product={{ id: product.id, name: product.name, slug: product.slug, sku: product.sku, price: product.price, inStock: product.inStock, brand: product.brand, imageUrl: product.images[0]?.url }} />
    </div>
  );

  return (
    <div className="buybox">
      {(product.sku || product.brand) && (
        <div className="buybox__meta">
          {product.sku && <CopySkuTag key={product.sku} sku={product.sku} />}
          {product.brand && (
            <Link href={brandHref(product)} className="product-meta-tag" title={`Усі товари бренду ${product.brand}`}>
              Бренд <strong translate="no">{product.brand}</strong><ChevronRightIcon />
            </Link>
          )}
        </div>
      )}
      <h1>{product.name}</h1>
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
        </div>
        <p className={product.inStock ? "stock stock--in" : "stock stock--out"}>{product.inStock ? "В наявності" : "Немає в наявності"}</p>
        {product.variants.length > 1 && <ProductVariants variants={product.variants} />}
        {priced ? <BuyForm product={cartProduct} inStock={buyable} actionsClassName="buybox__actions" aside={tools} /> : tools}
      </div>
    </div>
  );
}
