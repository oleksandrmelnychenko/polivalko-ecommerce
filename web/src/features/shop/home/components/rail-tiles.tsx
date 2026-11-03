import { ProductTile } from "@/features/shop/catalog";
import type { ProductListItem } from "@/shared/api/types";

export function RailTiles({ products }: { products: ProductListItem[] }) {
  return (
    <ul className="tiles tiles--rail">
      {products.map((p) => (
        <ProductTile key={p.id} product={p} look />
      ))}
    </ul>
  );
}
