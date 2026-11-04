import { BuyForm } from "@/features/cart";
import { discountPercent } from "@/features/catalog";
import { FavoriteButton } from "@/features/favorites";
import type { ProductDetails } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { ProductDeliveryFacts } from "./product-delivery-facts";
import { ProductVariants } from "./product-variants";

export function ProductBuybox({ product }: { product: ProductDetails }) {
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
            Бренд: <span translate="no">{product.brand}</span>
          </span>
        )}
      </p>
      <div className="buybox__card">
        <div>
          {discount && product.oldPrice && (
            <p className="buybox__was">
              <s className="price-old">
                <span className="visually-hidden">Стара ціна </span>
                {formatMoney(product.oldPrice)}
              </s>
              <span className="flag flag--sale">−{discount}%</span>
            </p>
          )}
          <p className="buybox__price">
            <strong className={discount ? "price-sale" : undefined}>{formatMoney(product.price)}</strong>
          </p>
          <p className={product.inStock ? "stock stock--in" : "stock stock--out"}>{product.inStock ? "В наявності" : "Немає в наявності"}</p>
        </div>
        {product.variants.length > 1 && <ProductVariants variants={product.variants} />}
        <BuyForm product={cartProduct} inStock={product.inStock} actionsClassName="buybox__actions" aside={<FavoriteButton productId={product.id} variant="box" />} />
      </div>
      <ProductDeliveryFacts />
    </div>
  );
}
