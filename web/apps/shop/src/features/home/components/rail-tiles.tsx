import { ProductTile } from "@/features/catalog";
import type { ProductListItem } from "@polivalko/shared/api/types";

export function RailTiles({ products }: { products: ProductListItem[] }) {
  return (
    <ul className="tiles tiles--rail">
      {products.map((p) => (
        <ProductTile key={p.id} product={p} />
      ))}
    </ul>
  );
}
