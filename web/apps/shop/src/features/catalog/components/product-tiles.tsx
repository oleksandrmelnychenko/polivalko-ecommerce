import type { ProductListItem } from "@polivalko/shared/api/types";
import { ProductTile } from "./product-tile";

export function ProductTiles({ products, columns, priority }: { products: ProductListItem[]; columns?: 2 | 3; priority?: boolean }) {
  return (
    <ul className={columns ? `tiles tiles--${columns}` : "tiles"}>
      {products.map((product, i) => (
        <ProductTile key={product.id} product={product} priority={priority && i < 3} />
      ))}
    </ul>
  );
}
