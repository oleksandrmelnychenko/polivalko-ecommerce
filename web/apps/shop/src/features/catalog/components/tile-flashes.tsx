import type { ProductListItem } from "@polivalko/shared/api/types";
import { splitRibbon, withoutSaleLabel } from "../lib/labels";
import { ProductLabels } from "./product-labels";

export function TileFlashes({ product, discountShown }: { product: ProductListItem; discountShown: boolean }) {
  const { ribbon, rest } = splitRibbon(withoutSaleLabel(product.labels, discountShown));
  if (!ribbon && rest.length === 0) return null;
  return (
    <span className="tile__flashes">
      {ribbon && (
        <span className="flash flash--right flash--label" data-tone={ribbon.tone}>
          {ribbon.name}
        </span>
      )}
      <ProductLabels labels={rest} className={ribbon ? "tile__labels" : "tile__labels tile__labels--top"} />
    </span>
  );
}
