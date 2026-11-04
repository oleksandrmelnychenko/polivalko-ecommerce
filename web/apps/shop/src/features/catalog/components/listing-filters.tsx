import Form from "next/form";
import Link from "next/link";
import type { ProductSearch } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { hrefFor, type Parsed } from "../lib/listing-params";

export function ListingFilters({
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

      <button type="submit" className="btn btn--dark btn--small filters__submit">
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
