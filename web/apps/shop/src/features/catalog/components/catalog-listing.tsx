import Link from "next/link";
import { redirect } from "next/navigation";
import { CloseIcon } from "@polivalko/shared/ui/icons";
import { itemListJsonLd, JsonLd } from "@/features/seo";
import { searchProducts, type ProductQuery } from "../api/server";
import { hrefFor, parseListingParams, toQuery, type Parsed, type SearchParams } from "../lib/listing-params";
import { FiltersPanel } from "./filters-panel";
import { ListingFilters } from "./listing-filters";
import { ListingPager } from "./listing-pager";
import { ListingResults } from "./listing-results";
import { ListingNavigation } from "./listing-navigation";

const CLEARED: Partial<Parsed> = { brands: [], attrs: [], inStock: false, onSale: false, priceMin: undefined, priceMax: undefined, page: 1 };

function priceChip(min?: number, max?: number) {
  const money = (n: number) => n.toLocaleString("uk-UA");
  if (min && max) return `Ціна: ${money(min)}–${money(max)} ₴`;
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
  listName,
  saleOnly = false,
  compact = saleOnly,
}: {
  basePath: string;
  base: ProductQuery;
  fixed?: Record<string, string>;
  searchParams: SearchParams | Promise<SearchParams>;
  emptyHint: string;
  compact?: boolean;
  listName?: string;
  saleOnly?: boolean;
}) {
  const p = parseListingParams(await searchParams, basePath);
  const query = toQuery(base, p);
  const result = await searchProducts(query);
  if (!result) return null;

  const href = (patch: Partial<Parsed>) => hrefFor(basePath, fixed, p, patch);
  // A page past the end (an old link, fewer products now) opens the last page instead of an empty list
  // with a counter like «2353–10 з 10». A document request already got a real 307 from src/proxy.ts;
  // this covers client navigations, where inside Suspense the redirect happens in the browser.
  if (result.page > Math.max(result.totalPages, 1)) redirect(href({ page: Math.max(result.totalPages, 1) }));
  const chips = activeChips(p, href);
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
      <FiltersPanel active={chips.length} compact={compact}>
        <ListingFilters facets={result.facets} basePath={basePath} fixed={fixed} saleOnly={saleOnly} compact={compact} />
      </FiltersPanel>
      <div className="catalog__main">
        <ListingResults
          queryKey={href({})}
          initial={result}
          query={query}
          path={basePath}
          compact={compact}
        >

          {chips.length > 0 && (
            <div className="active-filters">
              <ul aria-label="Вибрані фільтри">
                {chips.map((c) => (
                  <li key={c.key}>
                    <Link href={c.href} scroll={false} aria-label={`Прибрати фільтр «${c.label}»`}>
                      <span>{c.label}</span>
                      <CloseIcon />
                    </Link>
                  </li>
                ))}
              </ul>
              {chips.length > 1 && (
                <Link className="active-filters__reset" href={href(CLEARED)} scroll={false}>
                  Скинути все
                </Link>
              )}
            </div>
          )}

          {result.items.length === 0 && (
            <div className="empty">
              <h2>Товарів не знайдено</h2>
              <p>{chips.length > 0 ? "Спробуйте прибрати частину фільтрів." : emptyHint}</p>
              {chips.length > 0 && (
                <Link className="btn btn--quiet" href={href(CLEARED)}>
                  Скинути фільтри
                </Link>
              )}
            </div>
          )}
        </ListingResults>

        <ListingPager result={result} href={(page) => href({ page })} />
      </div>
    </div></ListingNavigation>
  );
}
