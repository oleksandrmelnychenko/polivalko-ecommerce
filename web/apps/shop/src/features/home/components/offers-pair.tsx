import Link from "next/link";
import { connection } from "next/server";
import { discountPercent, ProductTiles } from "@/features/catalog";
import { getCollections, searchProducts } from "@/features/catalog/server";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";

export async function OffersPair() {
  await connection();
  const [sale, collections] = await Promise.all([
    searchProducts({ onSale: true, inStock: true, sort: "price_asc", pageSize: 12 }).catch(() => null),
    getCollections().catch(() => []),
  ]);
  const discounted = (sale?.items ?? []).filter(product => discountPercent(product.price, product.oldPrice) !== null);
  const curated = collections.flatMap(collection => collection.items).filter(product => product.inStock && product.imageUrl && discountPercent(product.price, product.oldPrice) !== null);
  const featured = curated[0] ?? discounted[0];
  if (!featured) return null;
  const seenImages = new Set<string>([featured.imageUrl || featured.id]);
  const varied = discounted.filter(product => {
    const image = product.imageUrl || product.id;
    if (seenImages.has(image)) return false;
    seenImages.add(image);
    return true;
  });
  const items = [...new Map([...curated.slice(1), ...varied, ...discounted].filter(product => product.id !== featured.id).map(product => [product.id, product])).values()].slice(0, 2);
  return <section className="home-sale" aria-labelledby="offers-title">
    <div className="container"><div className="home-sale__panel">
      <header className="home-sale__heading"><h2 id="offers-title">Акції</h2><Link href="/sale">Усі акційні товари <ArrowRightIcon /></Link></header>
      <div className="home-sale__showcase">
        <div className="home-sale__featured"><ProductTiles products={[featured]} /></div>
        {items.length > 0 && <div className="home-sale__supporting"><ProductTiles products={items} /></div>}
      </div>
    </div></div>
  </section>;
}
