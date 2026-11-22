import { connection } from "next/server";
import Link from "next/link";
import { formatMoney } from "@polivalko/shared/lib/format";
import type { CategoryNode } from "@polivalko/shared/api/types";
import { ProductTiles } from "@/features/catalog";
import { getBestsellers, getCategoryTree, getCollections, searchProducts } from "@/features/catalog/server";
import { CategoryFeature } from "./category-feature";
import { HomeSection } from "./home-section";

function flattenCategories(categories: CategoryNode[]): CategoryNode[] {
  return categories.flatMap(category => [category, ...flattenCategories(category.children)]);
}

export async function CollectionPairs() {
  await connection();
  const [collections, bestsellers, categories, result] = await Promise.all([
    getCollections().catch(() => []),
    getBestsellers(5).catch(() => null),
    getCategoryTree().catch(() => []),
    searchProducts({ inStock: true, pageSize: 48 }).catch(() => null),
  ]);
  const popular = bestsellers?.items.map(item => item.product) ?? [];
  const ranked = result?.items ?? [];
  const recommended = [...new Map([...ranked.slice(0, 3), ...collections.flatMap(collection => collection.items), ...ranked, ...popular]
    .filter(product => product.inStock).map(product => [product.id, product])).values()].slice(0, 5);
  const byId = new Map(flattenCategories(categories).map(category => [category.id, category]));
  const shown = new Set(recommended.map(product => product.id));
  const remaining = ranked.filter(product => !shown.has(product.id));
  const sections = [...new Set(remaining.map(product => product.categoryId))].flatMap(id => {
    const category = byId.get(id);
    const items = remaining.filter(product => product.categoryId === id).slice(0, 3);
    return category && items.length ? [{ category, items }] : [];
  }).slice(0, 2);

  return <>
    {popular.length > 0 && <section className="mobile-bestsellers container" aria-labelledby="mobile-bestsellers-title"><header><h2 id="mobile-bestsellers-title">Топ продажів</h2><Link href="/catalog">Усі ›</Link></header><ul>{popular.slice(0, 5).map((product) => <li key={product.id}><Link href={`/product/${product.slug}`}>{product.imageUrl && <img src={product.imageUrl} alt="" width={150} height={150} loading="lazy" />}<span>{product.name}</span><strong>{formatMoney(product.price)}</strong></Link></li>)}</ul></section>}
    {recommended.length > 0 && <HomeSection id="collection-title" title="Рекомендуємо зараз" className="home-recommendations" more={{ href: "/catalog", label: "Увесь каталог" }}>
      <ProductTiles products={recommended} />
    </HomeSection>}
    {sections.map(({ category, items }, i) => <CategoryFeature key={category.id} category={category} products={items} reverse={i % 2 === 1} />)}
  </>;
}
