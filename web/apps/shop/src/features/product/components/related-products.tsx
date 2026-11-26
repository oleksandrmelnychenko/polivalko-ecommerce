import Link from "next/link";
import { ProductTiles } from "@/features/catalog";
import { searchProducts } from "@/features/catalog/server";
import { relatedItems, sameKindItems, typeWord } from "../lib/related";

export async function RelatedProducts({ category, exclude, name }: { category: string; exclude: string; name: string }) {
  // The first tiles of the category were the same for every product in it: a controller got fittings, a tomato got
  // parsley. Products of the same kind in the category come first now; the category fills what is left.
  const kind = typeWord(name);
  const [sameKind, sameCategory] = await Promise.all([
    kind ? searchProducts({ category, q: kind, pageSize: 6, inStock: true }).catch(() => null) : null,
    searchProducts({ category, pageSize: 6, inStock: true }),
  ]);
  const items = relatedItems(sameKindItems(sameKind), sameCategory?.items ?? [], exclude);
  if (items.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-title">
      <div className="related__head">
        <h2 id="related-title">Схожі товари</h2>
        <Link href={`/catalog/${category}`} className="related__all">
          Уся категорія
        </Link>
      </div>
      <ProductTiles products={items} />
    </section>
  );
}
