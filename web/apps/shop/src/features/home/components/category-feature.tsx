import Link from "next/link";
import type { CategoryNode, ProductListItem } from "@polivalko/shared/api/types";
import { categoryPhotos, pagePhotos } from "@polivalko/shared/lib/stand-in-photos";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { ProductTiles } from "@/features/catalog";

export function CategoryFeature({ category, products, reverse = false }: { category: CategoryNode; products: ProductListItem[]; reverse?: boolean }) {
  const photo = category.slug === "vse-dlia-vidpochynku" ? pagePhotos.collection : categoryPhotos[category.slug];
  return <section className={`home-feature${reverse ? " home-feature--reverse" : ""}`} aria-labelledby={`category-${category.slug}-title`}>
    <div className="container home-feature__layout">
      <div className="home-feature__story">
        {photo && <img src={photo.url} alt={photo.alt} width={800} height={800} loading="lazy" />}
        <div className="home-feature__copy">
          <h2 id={`category-${category.slug}-title`}>{category.name}</h2>
          <p>{category.slug === "vse-dlia-vidpochynku" ? "Облаштуйте місце для відпочинку на терасі та подвір’ї." : "Шланги, дощувачі, з’єднання та обладнання для автополиву."}</p>
          <Link href={`/catalog/${category.slug}`}>Переглянути розділ <ArrowRightIcon /></Link>
        </div>
      </div>
      <div className="home-feature__products">
        <nav className="home-feature__links" aria-label={`Підрозділи: ${category.name}`}>
          {category.children.slice(0, 3).map(child => <Link key={child.id} href={`/catalog/${child.slug}`}>{child.name}<ArrowRightIcon /></Link>)}
        </nav>
        <ProductTiles products={products.slice(0, 3)} />
      </div>
    </div>
  </section>;
}
