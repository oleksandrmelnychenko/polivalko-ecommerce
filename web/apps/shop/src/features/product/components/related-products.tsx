import Link from "next/link";
import { ProductTiles } from "@/features/catalog";
import { searchProducts } from "@/features/catalog/server";

export async function RelatedProducts({ category, exclude }: { category: string; exclude: string }) {
  const result = await searchProducts({ category, pageSize: 6, inStock: true });
  const items = (result?.items ?? []).filter((p) => p.id !== exclude).slice(0, 5);
  if (items.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-title">
      <div className="related__head">
        <div>
          <p className="related__kicker">З цього ж розділу</p>
          <h2 id="related-title">Схожі товари</h2>
        </div>
        <Link href={`/catalog/${category}`} className="related__all">
          Уся категорія
        </Link>
      </div>
      <ProductTiles products={items} />
    </section>
  );
}
