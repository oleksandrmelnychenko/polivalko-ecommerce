import type { ProductDetails } from "@polivalko/shared/api/types";

export function displayAttributes(product: ProductDetails) {
  return product.attributes.filter(({ name, value }) => {
    const label = name.trim().toLowerCase();
    return label !== "артикул dntrade" && (label !== "штрихкод" || value !== product.sku);
  });
}
