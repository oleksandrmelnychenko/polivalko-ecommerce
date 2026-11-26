import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import type { BrandPage, BrandSummary } from "@polivalko/shared/api/types";
import { countProducts } from "@polivalko/shared/lib/format";
import { ArrowRightIcon } from "@polivalko/shared/ui/icons";
import { breadcrumbJsonLd, itemListJsonLd, JsonLd } from "@/features/seo";
import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { introParagraphs } from "../lib/category-intro";
import { parsePage, type SearchParams } from "../lib/listing-params";
import { CatalogListing } from "./catalog-listing";
import { ListingSkeleton } from "./listing-skeleton";

const BRANDS = { name: "Бренди", path: "/brands" };

// Manufacturer marks used until a logo is supplied through the console.
const manufacturerMarks = new Map([
  ["irritec", "irritec"], ["fiskars", "fiskars"], ["cellfast", "cellfast"],
  ["сімейний сад", "simeinyi-sad"],
]);

function directoryLogo(brand: BrandSummary) {
  if (brand.logoUrl?.trim()) return brand.logoUrl.trim();
  const mark = manufacturerMarks.get(brand.name.trim().toLowerCase());
  return mark ? `/brand/manufacturers/${mark}.webp` : undefined;
}

export const brandPath = (slug: string) => `/brands/${slug}`;

/** The page resolves the brand first (see requireBrand), so a brand without a page is a real 404. */
export function BrandScreen({ brand, searchParams }: { brand: BrandPage; searchParams: Promise<SearchParams> }) {
  const path = brandPath(brand.slug);
  return (
    <div className="container catalog-page listing-page brand-page">
      <JsonLd data={breadcrumbJsonLd([BRANDS, { name: brand.name, path }])} />
      <Breadcrumbs current={brand.name} parents={[BRANDS]} />
      <header className="page-head brand-page__head">
        {brand.logoUrl && <img className="brand-page__logo" src={brand.logoUrl} alt="" width={96} height={48} decoding="async" />}
        <h1>{brand.name}</h1>
      </header>
      <Suspense fallback={<ListingSkeleton head={false} />}>
        <BrandListing brand={brand} searchParams={searchParams} />
      </Suspense>
      <OnFirstPage searchParams={searchParams}>
        <BrandAbout brand={brand} />
      </OnFirstPage>
    </div>
  );
}

async function BrandListing({ brand, searchParams }: { brand: BrandPage; searchParams: Promise<SearchParams> }) {
  return (
    <CatalogListing
      compact
      basePath={brandPath(brand.slug)}
      base={{ brandPage: brand.slug }}
      searchParams={await searchParams}
      listName={`Товари ${brand.name}`}
      emptyHint="Товарів цього бренду поки немає в продажу."
    />
  );
}

function BrandAbout({ brand }: { brand: BrandPage }) {
  const paragraphs = introParagraphs(brand.description);
  if (paragraphs.length === 0) return null;
  return (
    <div className="category-notes">
      <section className="category-intro" aria-labelledby="brand-about-heading">
        <h2 id="brand-about-heading">Про бренд {brand.name}</h2>
        <div className="category-intro__text">
          {paragraphs.map((text, i) => (
            <p key={i}>{text}</p>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Like the category intro: the same text on pages 2, 3… would be duplicate content. */
function OnFirstPage({ searchParams, children }: { searchParams: Promise<SearchParams>; children: ReactNode }) {
  return (
    <Suspense fallback={children}>
      <FirstPageOnly searchParams={searchParams}>{children}</FirstPageOnly>
    </Suspense>
  );
}

async function FirstPageOnly({ searchParams, children }: { searchParams: Promise<SearchParams>; children: ReactNode }) {
  return parsePage((await searchParams).page) === 1 ? children : null;
}

export function BrandsScreen({ brands }: { brands: BrandSummary[] }) {
  return (
    <div className="container brands-page">
      <JsonLd data={breadcrumbJsonLd([BRANDS])} />
      {brands.length > 0 && <JsonLd data={itemListJsonLd("Бренди", brands.map((b) => ({ name: b.name, path: brandPath(b.slug), image: b.logoUrl })))} />}
      <Breadcrumbs current={BRANDS.name} />
      <header className="page-head">
        <h1>Бренди</h1>
      </header>
      <ul className="brand-list">
        {brands.map((brand) => {
          const logo = directoryLogo(brand);
          return (
            <li key={brand.slug}>
              <Link href={brandPath(brand.slug)} prefetch={false}>
                <span className="brand-list__mark">
                  {logo
                    ? <img src={logo} alt={brand.name} width={144} height={44} loading="lazy" decoding="async" />
                    : brand.name}
                </span>
                <span className="brand-list__meta">
                  {countProducts(brand.productCount)}
                  <ArrowRightIcon aria-hidden="true" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
