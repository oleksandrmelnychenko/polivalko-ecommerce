import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { CatalogListing, ListingSkeleton } from "@/components/catalog-listing";
import { getCategory, resolveRedirect } from "@/lib/catalog";

export async function generateMetadata({ params, searchParams }: PageProps<"/catalog/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const category = await getCategory(slug);
  if (!category) return { title: "Розділ не знайдено" };
  // Фільтри, сортування й сторінки ведуть canonical на сам розділ і не індексуються,
  // але посилання з них індексатор проходить (правила індексації фільтрів, розділ 10 ТЗ).
  const filtered = Object.keys(sp).length > 0;
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? undefined,
    alternates: { canonical: `/catalog/${slug}` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default function CategoryPage(props: PageProps<"/catalog/[slug]">) {
  return (
    <div className="container">
      <Suspense fallback={<ListingSkeleton />}>
        <CategoryContent {...props} />
      </Suspense>
    </div>
  );
}

async function CategoryContent({ params, searchParams }: PageProps<"/catalog/[slug]">) {
  const { slug } = await params;
  const [category, sp] = await Promise.all([getCategory(slug), searchParams]);
  if (!category) {
    const target = await resolveRedirect(`/catalog/${slug}`);
    if (target) permanentRedirect(target);
    notFound();
  }

  return (
    <>
      <header className="page-head">
        <nav className="crumbs" aria-label="Хлібні крихти">
          <ol>
            <li>
              <Link href="/catalog">Каталог</Link>
            </li>
            {category.breadcrumbs.map((c) => (
              <li key={c.id}>
                <Link href={`/catalog/${c.slug}`}>{c.name}</Link>
              </li>
            ))}
            <li aria-current="page">{category.name}</li>
          </ol>
        </nav>
        <h1>{category.name}</h1>
        {category.children.length > 0 && (
          <nav aria-label="Підрозділи">
            <ul className="chips chips--grey">
              {category.children.map((child) => (
                <li key={child.id}>
                  <Link href={`/catalog/${child.slug}`}>{child.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>
      <CatalogListing
        basePath={`/catalog/${slug}`}
        base={{ category: slug }}
        searchParams={sp}
        emptyHint="У цьому розділі поки немає товарів. Загляньте в інші розділи каталогу."
      />
    </>
  );
}
