import Link from "next/link";
import type { ProductListItem } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";

export function MegaProduct({ product }: { product: ProductListItem }) {
  return (
    <div className="mega-col mega-col--product">
      <p className="mega-col__title">Зі знижкою</p>
      <Link href={`/product/${product.slug}`} className="mega-product">
        {product.imageUrl && <img src={thumb(product.imageUrl, 250)} alt="" width={120} height={120} loading="lazy" />}
        <span className="mega-product__name">{product.name}</span>
        <span className="mega-product__price">
          {product.oldPrice && <s><span className="money">{formatMoney(product.oldPrice)}</span></s>} <span className="money">{formatMoney(product.price)}</span>
        </span>
      </Link>
    </div>
  );
}
