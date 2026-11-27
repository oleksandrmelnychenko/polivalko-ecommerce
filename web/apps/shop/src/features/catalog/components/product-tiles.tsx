import type { ProductListItem } from "@polivalko/shared/api/types";
import { ProductTile } from "./product-tile";

export function ProductTiles({ products, columns, priority, listing }: { products: ProductListItem[]; columns?: 2 | 3; priority?: boolean; listing?: boolean }) {
  const classes = ["tiles", columns ? `tiles--${columns}` : "", listing ? "tiles--listing" : ""].filter(Boolean).join(" ");
  return (
    <ul className={classes}>
      {products.map((product, i) => (
        <ProductTile key={product.id} product={product} priority={priority && i < 3} />
      ))}
    </ul>
  );
}
