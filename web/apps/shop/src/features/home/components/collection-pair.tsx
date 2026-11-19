import { connection } from "next/server";
import Link from "next/link";
import { formatMoney } from "@polivalko/shared/lib/format";
import { ProductTiles } from "@/features/catalog";
import { getBestsellers, getCategoryTree, getCollections, searchProducts } from "@/features/catalog/server";
import { CategoryFeature } from "./category-feature";
import { HomeSection } from "./home-section";

const FEATURED_CATEGORIES = ["vse-dlia-vidpochynku", "vse-dlia-polyvu"];

export async function CollectionPairs() {
  await connection();
  const [collections, bestsellers, categories] = await Promise.all([
    getCollections().catch(() => []),
    getBestsellers(5).catch(() => null),
    getCategoryTree().catch(() => []),
  ]);
  const popular = bestsellers?.items.map(item => item.product) ?? [];
  const recommended = [...new Map([...collections.flatMap(collection => collection.items), ...popular]
    .filter(product => product.inStock).map(product => [product.id, product])).values()].slice(0, 5);
  const sections = await Promise.all(categories.filter(category => FEATURED_CATEGORIES.includes(category.slug)).map(async category => {
    const found = await Promise.all(category.children.slice(0, 3).map(child => searchProducts({ category: child.slug, inStock: true, pageSize: 6 }).catch(() => null)));
    const usedPhotos = new Set<string>();
    let items = found.flatMap(result => {
      const product = result?.items.find(item => !usedPhotos.has(item.imageUrl || item.id)) ?? result?.items[0];
      if (!product) return [];
      usedPhotos.add(product.imageUrl || product.id);
      return [product];
    });
    if (items.length < 3) {
      const fallback = await searchProducts({ category: category.slug, inStock: true, pageSize: 3 }).catch(() => null);
      items = [...new Map([...items, ...(fallback?.items ?? [])].map(product => [product.id, product])).values()].slice(0, 3);
    }
    return { category, items };
  }));

  return <>
    {popular.length > 0 && <section className="mobile-bestsellers container" aria-labelledby="mobile-bestsellers-title"><header><h2 id="mobile-bestsellers-title">Топ продажів</h2><Link href="/catalog">Усі ›</Link></header><ul>{popular.slice(0, 5).map((product) => <li key={product.id}><Link href={`/product/${product.slug}`}>{product.imageUrl && <img src={product.imageUrl} alt="" width={150} height={150} loading="lazy" />}<span>{product.name}</span><strong>{formatMoney(product.price)}</strong></Link></li>)}</ul></section>}
    {recommended.length > 0 && <HomeSection id="collection-title" title="Рекомендовано для вас" className="home-recommendations" more={{ href: "/catalog", label: "Увесь каталог" }}>
      <ProductTiles products={recommended} />
    </HomeSection>}
    {sections.filter(section => section.items.length).map(({ category, items }, i) => <CategoryFeature key={category.id} category={category} products={items} reverse={i % 2 === 1} />)}
  </>;
}
