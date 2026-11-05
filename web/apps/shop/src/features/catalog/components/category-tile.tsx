import Link from "next/link";
import { sized } from "@polivalko/shared/lib/images";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { categoryPhotoUrl } from "../lib/category-photo";

export type CategoryItem = { id: string; slug: string; name: string; imageUrl?: string | null };

export function CategoryTile({ category, look }: { category: CategoryItem; look?: boolean }) {
  const photo = categoryPhotoUrl(category);
  const image = photo ? sized(photo, "(max-width: 40rem) 46vw, (max-width: 75rem) 30vw, 380px", 330) : null;
  const href = `/catalog/${category.slug}`;
  return (
    <li className={look ? "tile tile--look" : "tile"}>
      {look && <Link href={href} className="tile__cover" tabIndex={-1} aria-hidden="true" />}
      <figure className="tile__photo">{image && <img {...image} alt="" width={300} height={400} loading="lazy" fetchPriority="low" decoding="async" />}</figure>
      <div className="tile__body">
        <p className="tile__name tile__name--caps">
          <Link href={href}>{category.name}</Link>
        </p>
        {look && (
          <div className="tile__actions" aria-hidden="true">
            <span className="round-btn">
              <ArrowRightIcon />
            </span>
          </div>
        )}
      </div>
    </li>
  );
}
