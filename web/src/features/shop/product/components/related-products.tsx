import { ProductTiles } from "@/features/shop/catalog";
import { searchProducts } from "@/features/shop/catalog/server";

export async function RelatedProducts({ category, exclude }: { category: string; exclude: string }) {
  const result = await searchProducts({ category, pageSize: 5, sort: "name_asc" });
  const items = (result?.items ?? []).filter((p) => p.id !== exclude).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-title">
      <h2 id="related-title">Схожі товари</h2>
      <ProductTiles products={items} />
    </section>
  );
}
