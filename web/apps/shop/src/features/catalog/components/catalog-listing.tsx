import Link from "next/link";
import { redirect } from "next/navigation";
import { countProducts } from "@polivalko/shared/lib/format";
import { itemListJsonLd, JsonLd } from "@/features/seo";
import { searchProducts, type ProductQuery } from "../api/server";
import { hrefFor, parseListingParams, toQuery, type Parsed, type SearchParams } from "../lib/listing-params";
import { FiltersPanel } from "./filters-panel";
import { ListingFilters } from "./listing-filters";
import { ListingPager } from "./listing-pager";
import { ListingToolbar } from "./listing-toolbar";
import { ListingNavigation } from "./listing-navigation";
import { ProductTiles } from "./product-tiles";

type Subcategory = { id: string; slug: string; name: string };

const CLEARED: Partial<Parsed> = { brands: [], attrs: [], inStock: false, onSale: false, priceMin: undefined, priceMax: undefined, page: 1 };

function priceChip(min?: number, max?: number) {
  const money = (n: number) => n.toLocaleString("uk-UA");
  if (min && max) return `Ціна: від ${money(min)} до ${money(max)} ₴`;
  if (min) return `Ціна: від ${money(min)} ₴`;
  return `Ціна: до ${money(max ?? 0)} ₴`;
}

function activeChips(p: Parsed, href: (patch: Partial<Parsed>) => string) {
  const chips: { key: string; label: string; href: string }[] = [];
  if (p.inStock) chips.push({ key: "inStock", label: "Лише в наявності", href: href({ inStock: false, page: 1 }) });
  if (p.onSale) chips.push({ key: "onSale", label: "Зі знижкою", href: href({ onSale: false, page: 1 }) });
  if (p.priceMin || p.priceMax) chips.push({ key: "price", label: priceChip(p.priceMin, p.priceMax), href: href({ priceMin: undefined, priceMax: undefined, page: 1 }) });
  p.brands.forEach((b) => chips.push({ key: `b:${b}`, label: b, href: href({ brands: p.brands.filter((x) => x !== b), page: 1 }) }));
  p.attrs.forEach((a) => {
    const [name, ...rest] = a.split(":");
    chips.push({ key: `f:${a}`, label: `${name}: ${rest.join(":")}`, href: href({ attrs: p.attrs.filter((x) => x !== a), page: 1 }) });
  });
  return chips;
}

export async function CatalogListing({
  basePath,
  base,
  fixed = {},
  searchParams,
  emptyHint,
  subcategories = [],
  listName,
  saleOnly = false,
}: {
  basePath: string;
  base: ProductQuery;
  fixed?: Record<string, string>;
  searchParams: SearchParams | Promise<SearchParams>;
  emptyHint: string;
  subcategories?: Subcategory[];
  listName?: string;
  saleOnly?: boolean;
}) {
  const p = parseListingParams(await searchParams);
  const result = await searchProducts(toQuery(base, p));
  if (!result) return null;

  const href = (patch: Partial<Parsed>) => hrefFor(basePath, fixed, p, patch);
  // A page past the end (an old link, fewer products now) opens the last page instead of an empty list
  // with a counter like «2353–10 з 10». A document request already got a real 307 from src/proxy.ts;
  // this covers client navigations, where inside Suspense the redirect happens in the browser.
  if (result.page > Math.max(result.totalPages, 1)) redirect(href({ page: Math.max(result.totalPages, 1) }));
  const chips = activeChips(p, href);
  const from = result.totalItems === 0 ? 0 : (result.page - 1) * result.pageSize + 1;
  const to = Math.min(result.page * result.pageSize, result.totalItems);
  const summary = result.approximate
    ? `Точних збігів немає, ось схожі: ${countProducts(result.totalItems)}`
    : result.totalItems === 0
      ? "Товарів не знайдено"
      : `Показано ${from}-${to} з ${result.totalItems.toLocaleString("uk-UA")}`;

  const itemList =
    listName && result.items.length > 0
      ? itemListJsonLd(
          listName,
          result.items.map((item) => ({ name: item.name, path: `/product/${item.slug}`, image: item.imageUrl })),
          (result.page - 1) * result.pageSize,
        )
      : null;

  return (
    <ListingNavigation basePath={basePath} fixed={fixed} parsed={p}><div className="catalog">
      {itemList && <JsonLd data={itemList} />}
      <FiltersPanel active={chips.length}>
        {subcategories.length > 0 && (
          <nav className="fw fw--nav" aria-labelledby="subcategories-title">
            <h2 className="fw__title" id="subcategories-title">
              Підрозділи
            </h2>
            <ul className="fw__links">
              {subcategories.map((c) => (
                <li key={c.id}>
                  <Link href={`/catalog/${c.slug}`}>{c.name}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
        <ListingFilters result={result} basePath={basePath} fixed={fixed} saleOnly={saleOnly} />
      </FiltersPanel>
      <div className="catalog__main">
        <ListingToolbar summary={summary} />

        {chips.length > 0 && (
          <div className="active-filters">
            <span className="active-filters__title">Вибрано:</span>
            <ul>
              {chips.map((c) => (
                <li key={c.key}>
                  <Link href={c.href} scroll={false} aria-label={`Прибрати фільтр «${c.label}»`}>
                    <span className={c.key === "price" ? "money" : undefined}>{c.label}</span>
                    <span aria-hidden="true">×</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="active-filters__reset" href={href(CLEARED)} scroll={false}>
              Скинути все
            </Link>
          </div>
        )}

        {result.items.length === 0 ? (
          <div className="empty">
            <h2>Товарів не знайдено</h2>
            <p>{chips.length > 0 ? "Спробуйте прибрати частину фільтрів." : emptyHint}</p>
            {chips.length > 0 && (
              <Link className="btn btn--quiet" href={href(CLEARED)}>
                Скинути фільтри
              </Link>
            )}
          </div>
        ) : (
          <ProductTiles products={result.items} priority />
        )}

        <ListingPager result={result} href={(page) => href({ page })} />
      </div>
    </div></ListingNavigation>
  );
}
