import Link from "next/link";
import { connection } from "next/server";
import { categoryPhotoUrl } from "@/features/catalog";
import { getCategoryTree } from "@/features/catalog/server";
import { sized } from "@polivalko/shared/lib/images";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { HomeSection } from "./home-section";

export async function SectionsPair() {
  await connection();
  const categories = await getCategoryTree().catch(() => []);
  if (categories.length === 0) return null;
  return (
    <>
    <nav className="mobile-categories container" aria-label="Категорії товарів">
      {categories.map((category) => <Link key={category.id} href={`/catalog/${category.slug}`}>
        <span>{categoryPhotoUrl(category) && <img src={categoryPhotoUrl(category)!} alt="" width={56} height={56} loading="lazy" />}</span>
        {category.name}
      </Link>)}
    </nav>
    <HomeSection id="sections-title" title="Категорії" more={{ href: "/catalog", label: "Увесь каталог" }} bordered>
      <ul className="cat-cards">
        {categories.map((c, i) => {
          const photo = categoryPhotoUrl(c);
          const image = photo ? sized(photo, i < 2 ? "(max-width: 48rem) 40vw, 320px" : "(max-width: 48rem) 40vw, 220px", 330) : null;
          const href = `/catalog/${c.slug}`;
          return (
            <li key={c.id} className={i < 2 ? "cat-card cat-card--wide" : "cat-card"}>
              <Link href={href} className="cat-card__photo" tabIndex={-1} aria-hidden="true">
                {image && <img {...image} alt="" width={320} height={320} loading="lazy" decoding="async" />}
              </Link>
              <div className="cat-card__body">
                <h3 className="cat-card__title">
                  <Link href={href}>{c.name}</Link>
                </h3>
                {c.description && <p className="cat-card__sub">{c.description}</p>}
                {c.children.length > 0 && (
                  <ul className="cat-card__chips">
                    {c.children.slice(0, i < 2 ? 10 : 4).map((child) => (
                      <li key={child.id}>
                        <Link href={`/catalog/${child.slug}`} className="chip chip--small">
                          {child.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href={href} className="cat-card__go">
                  Перейти
                  <ArrowRightIcon />
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </HomeSection>
    </>
  );
}
