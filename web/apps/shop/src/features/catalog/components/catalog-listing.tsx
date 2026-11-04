import Link from "next/link";
import { countProducts } from "@polivalko/shared/lib/format";
import { searchProducts, type ProductQuery } from "../api/server";
import { hrefFor, parseListingParams, SORTS, toQuery, type SearchParams } from "../lib/listing-params";
import { FiltersPanel } from "./filters-panel";
import { ListingFilters } from "./listing-filters";
import { ListingPager } from "./listing-pager";
import { ProductTiles } from "./product-tiles";

export async function CatalogListing({
  basePath,
  base,
  fixed = {},
  searchParams,
  emptyHint,
}: {
  basePath: string;
  base: ProductQuery;
  fixed?: Record<string, string>;
  searchParams: SearchParams;
  emptyHint: string;
}) {
  const p = parseListingParams(searchParams);
  const result = await searchProducts(toQuery(base, p));
  if (!result) return null;

  const filtered = p.brands.length > 0 || p.attrs.length > 0 || p.inStock || p.onSale || p.priceMin || p.priceMax;

  return (
    <div className="catalog">
      <FiltersPanel active={p.brands.length + p.attrs.length + (p.inStock ? 1 : 0) + (p.onSale ? 1 : 0) + (p.priceMin || p.priceMax ? 1 : 0)}>
        <ListingFilters result={result} parsed={p} basePath={basePath} fixed={fixed} filtered={Boolean(filtered)} />
      </FiltersPanel>
      <div>
        <div className="toolbar">
          <p aria-live="polite">
            {result.approximate ? `Точних збігів немає, ось схожі: ${countProducts(result.totalItems)}` : countProducts(result.totalItems)}
          </p>
          <nav className="seg" aria-label="Сортування">
            {SORTS.map((s) => (
              <Link
                key={s.value}
                href={hrefFor(basePath, fixed, p, { sort: s.value, page: 1 })}
                aria-current={s.value === p.sort ? "true" : undefined}
              >
                {s.label}
              </Link>
            ))}
          </nav>
        </div>

        {result.items.length === 0 ? (
          <div className="empty">
            <h2>Нічого не знайшлося</h2>
            <p>{filtered ? "Спробуйте прибрати частину фільтрів." : emptyHint}</p>
            {filtered && (
              <Link className="btn btn--quiet" href={hrefFor(basePath, fixed, p, { brands: [], attrs: [], inStock: false, onSale: false, priceMin: undefined, priceMax: undefined, page: 1 })}>
                Скинути фільтри
              </Link>
            )}
          </div>
        ) : (
          <ProductTiles products={result.items} columns={3} priority />
        )}

        <ListingPager result={result} href={(page) => hrefFor(basePath, fixed, p, { page })} />
      </div>
    </div>
  );
}
