import Form from "next/form";
import Link from "next/link";
import type { ProductSearch } from "@/lib/api/server";
import { searchProducts, type ProductQuery } from "@/lib/catalog";
import { countProducts, first, formatMoney } from "@/lib/format";
import { FiltersPanel } from "./filters-panel";
import { ProductTiles } from "./product-card";

type SearchParams = Record<string, string | string[] | undefined>;

const SORTS = [
  { value: "name_asc", label: "За назвою" },
  { value: "price_asc", label: "Дешевші" },
  { value: "price_desc", label: "Дорожчі" },
];

/** Читає стан фільтрів з URL: стан списку живе в адресі (посилання можна надіслати). */
export function parseListingParams(sp: SearchParams) {
  const all = (key: string) => {
    const v = sp[key];
    return (Array.isArray(v) ? v : v ? [v] : []).flatMap((x) => x.split(",")).filter(Boolean);
  };
  const num = (key: string) => {
    const n = Number(first(sp[key]));
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  // Характеристики "Назва:Значення" не розбиваємо за комою: значення може її містити.
  const attrs = (Array.isArray(sp.f) ? sp.f : sp.f ? [sp.f] : []).filter((x) => x.includes(":"));
  return {
    brands: all("brand"),
    attrs,
    inStock: first(sp.inStock) === "true",
    onSale: first(sp.onSale) === "true",
    priceMin: num("priceMin"),
    priceMax: num("priceMax"),
    sort: SORTS.some((s) => s.value === first(sp.sort)) ? first(sp.sort)! : "name_asc",
    page: Math.max(Number(first(sp.page)) || 1, 1),
  };
}

type Parsed = ReturnType<typeof parseListingParams>;

function toQuery(base: ProductQuery, p: Parsed): ProductQuery {
  return {
    ...base,
    brand: p.brands.length ? p.brands.join(",") : undefined,
    f: p.attrs.length ? p.attrs : undefined,
    inStock: p.inStock || undefined,
    onSale: p.onSale || undefined,
    priceMin: p.priceMin,
    priceMax: p.priceMax,
    sort: p.sort,
    page: p.page,
  };
}

function hrefFor(basePath: string, fixed: Record<string, string>, p: Parsed, patch: Partial<Parsed>) {
  const next = { ...p, ...patch };
  const qs = new URLSearchParams(fixed);
  next.brands.forEach((b) => qs.append("brand", b));
  next.attrs.forEach((a) => qs.append("f", a));
  if (next.inStock) qs.set("inStock", "true");
  if (next.onSale) qs.set("onSale", "true");
  if (next.priceMin) qs.set("priceMin", String(next.priceMin));
  if (next.priceMax) qs.set("priceMax", String(next.priceMax));
  if (next.sort !== "name_asc") qs.set("sort", next.sort);
  if (next.page > 1) qs.set("page", String(next.page));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

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
        <Filters result={result} parsed={p} basePath={basePath} fixed={fixed} filtered={Boolean(filtered)} />
      </FiltersPanel>
      <div>
        <div className="toolbar">
          <p aria-live="polite">{countProducts(result.totalItems)}</p>
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

        <Pager result={result} href={(page) => hrefFor(basePath, fixed, p, { page })} />
      </div>
    </div>
  );
}

function Filters({
  result,
  parsed,
  basePath,
  fixed,
  filtered,
}: {
  result: ProductSearch;
  parsed: Parsed;
  basePath: string;
  fixed: Record<string, string>;
  filtered: boolean;
}) {
  const { facets } = result;
  return (
    <Form action={basePath} className="filters" aria-label="Фільтри">
      {Object.entries(fixed).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {parsed.sort !== "name_asc" && <input type="hidden" name="sort" value={parsed.sort} />}

      <fieldset>
        <legend>Наявність і ціна</legend>
        <label className="check">
          <input type="checkbox" name="inStock" value="true" defaultChecked={parsed.inStock} />
          <span>Лише в наявності</span>
          <span className="check__count">{facets.inStockCount}</span>
        </label>
        <label className="check">
          <input type="checkbox" name="onSale" value="true" defaultChecked={parsed.onSale} />
          <span>Зі знижкою</span>
        </label>
      </fieldset>

      {facets.brands.length > 0 && (
        <fieldset>
          <legend>Бренд</legend>
          {facets.brands.map((b) => (
            <label key={b.name} className="check">
              <input type="checkbox" name="brand" value={b.name} defaultChecked={parsed.brands.includes(b.name)} />
              <span>{b.name}</span>
              <span className="check__count">{b.count}</span>
            </label>
          ))}
        </fieldset>
      )}

      {facets.attributes.map((attribute) => (
        <fieldset key={attribute.name}>
          <legend>{attribute.name}</legend>
          {attribute.values.map((v) => {
            const value = `${attribute.name}:${v.value}`;
            return (
              <label key={v.value} className="check">
                <input type="checkbox" name="f" value={value} defaultChecked={parsed.attrs.includes(value)} />
                <span>{v.value}</span>
                <span className="check__count">{v.count}</span>
              </label>
            );
          })}
        </fieldset>
      ))}

      <fieldset>
        <legend>Ціна, ₴</legend>
        <div className="range">
          <label className="visually-hidden" htmlFor="price-min">
            Ціна від
          </label>
          <input
            id="price-min"
            name="priceMin"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={facets.priceMin ? `від ${Math.floor(Number(facets.priceMin.value))}` : "від"}
            defaultValue={parsed.priceMin}
          />
          <label className="visually-hidden" htmlFor="price-max">
            Ціна до
          </label>
          <input
            id="price-max"
            name="priceMax"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={facets.priceMax ? `до ${Math.ceil(Number(facets.priceMax.value))}` : "до"}
            defaultValue={parsed.priceMax}
          />
        </div>
        {facets.priceMin && facets.priceMax && (
          <p className="field__help" style={{ marginTop: "var(--space-xs)" }}>
            У цьому розділі від {formatMoney(facets.priceMin)} до {formatMoney(facets.priceMax)}
          </p>
        )}
      </fieldset>

      <button type="submit" className="btn btn--dark btn--small">
        Показати товари
      </button>
      {filtered && (
        <Link className="link" href={hrefFor(basePath, fixed, parsed, { brands: [], attrs: [], inStock: false, onSale: false, priceMin: undefined, priceMax: undefined, page: 1 })}>
          Скинути фільтри
        </Link>
      )}
    </Form>
  );
}

function Pager({ result, href }: { result: ProductSearch; href: (page: number) => string }) {
  if (result.totalPages <= 1) return null;
  const pages = Array.from({ length: result.totalPages }, (_, i) => i + 1).filter(
    (n) => n === 1 || n === result.totalPages || Math.abs(n - result.page) <= 1,
  );
  return (
    <nav className="pager" aria-label="Сторінки">
      {pages.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && n - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
          {n === result.page ? (
            <span aria-current="page">{n}</span>
          ) : (
            <Link href={href(n)} aria-label={`Сторінка ${n}`}>
              {n}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}

export function ListingSkeleton() {
  return (
    <div className="catalog" aria-busy="true">
      <div className="skeleton" style={{ height: "var(--space-4xl)" }} />
      <div className="skeleton" style={{ height: "var(--space-4xl)" }} />
    </div>
  );
}
