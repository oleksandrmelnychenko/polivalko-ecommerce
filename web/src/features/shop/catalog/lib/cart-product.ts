import type { ProductListItem } from "@/shared/api/types";

export function toCartProduct(p: ProductListItem) {
  return { productId: p.id, name: p.name, slug: p.slug, sku: p.sku, price: p.price.value, imageUrl: p.imageUrl ?? null };
}
