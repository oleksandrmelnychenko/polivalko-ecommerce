import type { ProductListItem } from "@polivalko/shared/api/types";
import { splitRibbon } from "../lib/labels";
import { ProductLabels } from "./product-labels";

export function TileFlashes({ product, discount }: { product: ProductListItem; discount: number | null }) {
  const { ribbon, rest } = splitRibbon(product.labels);
  return (
    <span className="tile__flashes">
      {!product.inStock ? <span className="flash flash--out">Немає</span> : discount && <span className="flash">−{discount}%</span>}
      {ribbon && (
        <span className="flash flash--right flash--label" data-tone={ribbon.tone}>
          {ribbon.name}
        </span>
      )}
      <ProductLabels labels={rest} className={ribbon ? "tile__labels" : "tile__labels tile__labels--top"} />
    </span>
  );
}
