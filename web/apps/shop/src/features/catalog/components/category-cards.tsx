import Link from "next/link";
import { sized } from "@polivalko/shared/lib/images";
import { ArrowRightIcon, ChevronDownIcon, GridIcon } from "@polivalko/shared/ui/icons";
import { categoryPhotoUrl } from "../lib/category-photo";

type CategoryCardItem = { id: string; slug: string; name: string; imageUrl?: string | null; children?: { id: string; slug: string; name: string }[] };

export function CategoryCards({ categories, nested = false }: { categories: CategoryCardItem[]; nested?: boolean }) {
  return (
    <ul className="ctiles">
      {categories.map((category, index) => (
        <CategoryCard key={category.id} category={category} priority={!nested && index < 4} heading={nested ? "h3" : "h2"} />
      ))}
    </ul>
  );
}

function CategoryCard({ category, priority, heading: Heading }: { category: CategoryCardItem; priority: boolean; heading: "h2" | "h3" }) {
  const photo = categoryPhotoUrl(category);
  const image = photo ? sized(photo, "(max-width: 36rem) 36px, 52px", 330) : null;
  const children = category.children ?? [];
  const href = `/catalog/${category.slug}`;

  return (
    <li className="ctile">
      <Heading className="ctile__name">
        <Link href={href} className="ctile__link">
          <span className="ctile__photo" aria-hidden="true">
            {image ? <img {...image} alt="" width={96} height={96} loading={priority ? "eager" : "lazy"} decoding="async" /> : <GridIcon />}
          </span>
          <span>{category.name}</span>
          {children.length === 0 && <ArrowRightIcon className="ctile__go" />}
        </Link>
      </Heading>
      {children.length > 0 && (
        <details className="ctile__children">
          <summary aria-label={"Підрозділи категорії «" + category.name + "»"}><ChevronDownIcon /></summary>
          <ul className="ctile__subs">
            {children.map((child) => (
              <li key={child.id}><Link href={`/catalog/${child.slug}`}>{child.name}</Link></li>
            ))}
          </ul>
        </details>
      )}
    </li>
  );
}
