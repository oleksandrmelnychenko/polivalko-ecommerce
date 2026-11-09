import Link from "next/link";
import { sized } from "@polivalko/shared/lib/images";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { categoryPhotoUrl } from "../lib/category-photo";

type CategoryCardItem = { id: string; slug: string; name: string; imageUrl?: string | null; children?: { id: string; slug: string; name: string }[] };

const SHOWN_SUBCATEGORIES = 3;

export function CategoryCards({ categories }: { categories: CategoryCardItem[] }) {
  return (
    <ul className="ctiles">
      {categories.map((category, index) => (
        <CategoryCard key={category.id} category={category} priority={index < 4} />
      ))}
    </ul>
  );
}

function CategoryCard({ category, priority }: { category: CategoryCardItem; priority: boolean }) {
  const photo = categoryPhotoUrl(category);
  const image = photo ? sized(photo, "(max-width: 40rem) 50vw, (max-width: 75rem) 33vw, 320px", 500) : null;
  const children = category.children ?? [];
  const shown = children.slice(0, SHOWN_SUBCATEGORIES);
  const more = children.length - shown.length;
  const href = `/catalog/${category.slug}`;

  return (
    <li className="ctile">
      <figure className="ctile__photo">
        {image && <img {...image} alt="" width={400} height={500} loading={priority ? "eager" : "lazy"} decoding="async" />}
      </figure>
      <span className="ctile__go" aria-hidden="true">
        <ArrowRightIcon />
      </span>
      <div className="ctile__body">
        <span className="ctile__bar" aria-hidden="true" />
        <h2 className="ctile__name">
          <Link href={href} className="ctile__link">
            {category.name}
          </Link>
        </h2>
        {shown.length > 0 && (
          <ul className="ctile__subs" aria-label={`Підрозділи: ${category.name}`}>
            {shown.map((child) => (
              <li key={child.id}>
                <Link href={`/catalog/${child.slug}`}>{child.name}</Link>
              </li>
            ))}
            {more > 0 && (
              <li>
                <Link href={href} className="ctile__more">
                  ще {more}
                </Link>
              </li>
            )}
          </ul>
        )}
      </div>
    </li>
  );
}
