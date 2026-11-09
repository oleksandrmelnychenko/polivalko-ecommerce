"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import type { ProductSearch } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { hrefFor, priceRanges, type Parsed } from "../lib/listing-params";

const LIST_LIMIT = 6;
const SEARCH_FROM = 9;

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

const priceOf = (text: string) => {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

type Option = { key: string; label: string; count?: number; checked: boolean; name: string; value: string; onToggle: () => void; };

function FacetGroup({ title, options }: { title: string; options: Option[] }) {
  const id = useId();
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const searchable = options.length >= SEARCH_FROM;
  const needle = query.trim().toLowerCase();
  const matching = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const visible = expanded || needle ? matching : matching.filter((o, i) => i < LIST_LIMIT || o.checked);
  const hidden = matching.length - visible.length;

  return (
    <fieldset className="fw">
      <legend className="fw__title">{title}</legend>
      {searchable && (
        <div className="fw__search">
          <label className="visually-hidden" htmlFor={`${id}-q`}>
            Пошук у списку «{title}»
          </label>
          <input id={`${id}-q`} type="search" autoComplete="off" placeholder="Пошук у списку" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </div>
      )}
      <ul className="fw__list">
        {visible.map((o) => (
          <li key={o.key}>
            <label className="fcheck">
              <input type="checkbox" name={o.name} value={o.value} checked={o.checked} onChange={o.onToggle} />
              <span className="fcheck__box" aria-hidden="true" />
              <span className="fcheck__label">{o.label}</span>
              {o.count !== undefined && <span className="fcheck__count">{o.count}</span>}
            </label>
          </li>
        ))}
      </ul>
      {needle && matching.length === 0 && <p className="fw__empty">Нічого не знайшлося</p>}
      {!needle && (hidden > 0 || expanded) && matching.length > LIST_LIMIT && (
        <button type="button" className="fw__more" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Згорнути" : `Ще ${hidden}`}
        </button>
      )}
    </fieldset>
  );
}

export function ListingFilters({
  result,
  parsed,
  basePath,
  fixed,
  saleOnly = false,
}: {
  result: ProductSearch;
  parsed: Parsed;
  basePath: string;
  fixed: Record<string, string>;
  saleOnly?: boolean;
}) {
  const { facets } = result;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const current = hrefFor(basePath, fixed, parsed, {});
  const [synced, setSynced] = useState(current);
  const [selection, setSelection] = useState(parsed);
  const [priceMin, setPriceMin] = useState(parsed.priceMin ? String(parsed.priceMin) : "");
  const [priceMax, setPriceMax] = useState(parsed.priceMax ? String(parsed.priceMax) : "");

  if (synced !== current) {
    setSynced(current);
    setSelection(parsed);
    setPriceMin(parsed.priceMin ? String(parsed.priceMin) : "");
    setPriceMax(parsed.priceMax ? String(parsed.priceMax) : "");
  }

  function apply(patch: Partial<Parsed>) {
    const next = { ...selection, ...patch, page: 1 };
    setSelection(next);
    const href = hrefFor(basePath, fixed, next, {});
    if (href === current) return;
    startTransition(() => router.push(href, { scroll: false }));
  }

  function applyPrice() {
    const min = priceOf(priceMin);
    const max = priceOf(priceMax);
    if (min !== selection.priceMin || max !== selection.priceMax) apply({ priceMin: min, priceMax: max });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    applyPrice();
  }

  function applyOnEnter(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    applyPrice();
  }

  const low = facets.priceMin ? Math.floor(Number(facets.priceMin.value)) : undefined;
  const high = facets.priceMax ? Math.ceil(Number(facets.priceMax.value)) : undefined;
  const ranges = low !== undefined && high !== undefined ? priceRanges(low, high) : [];

  const availability: Option[] = [
    { key: "inStock", label: "Лише в наявності", count: facets.inStockCount, checked: selection.inStock, name: "inStock", value: "true", onToggle: () => apply({ inStock: !selection.inStock }) },
    { key: "onSale", label: "Зі знижкою", checked: selection.onSale, name: "onSale", value: "true", onToggle: () => apply({ onSale: !selection.onSale }) },
  ].filter((option) => !(saleOnly && option.key === "onSale"));

  return (
    <form action={basePath} className="filters" aria-label="Фільтри" aria-busy={pending} onSubmit={submit}>
      {Object.entries(fixed).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {parsed.sort !== "name_asc" && <input type="hidden" name="sort" value={parsed.sort} />}

      <FacetGroup title="Наявність" options={availability} />

      <fieldset className="fw">
        <legend className="fw__title">Ціна, ₴</legend>
        {ranges.length > 0 && (
          <ul className="fw__list">
            {ranges.map((r) => {
              const active = selection.priceMin === r.min && selection.priceMax === r.max;
              return (
                <li key={r.label}>
                  <button
                    type="button"
                    className="fprice"
                    aria-pressed={active}
                    onClick={() => {
                      setPriceMin(r.min ? String(r.min) : "");
                      setPriceMax(r.max ? String(r.max) : "");
                      apply(active ? { priceMin: undefined, priceMax: undefined } : { priceMin: r.min, priceMax: r.max });
                    }}
                  >
                    <span className="fprice__dot" aria-hidden="true" />
                    <span className="money">{r.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="range">
          <label className="visually-hidden" htmlFor="price-min">
            Ціна від
          </label>
          <input
            id="price-min"
            name="priceMin"
            className="money"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={low !== undefined ? `від ${low}` : "від"}
            value={priceMin}
            onChange={(event) => setPriceMin(event.currentTarget.value)}
            onBlur={applyPrice}
            onKeyDown={applyOnEnter}
          />
          <label className="visually-hidden" htmlFor="price-max">
            Ціна до
          </label>
          <input
            id="price-max"
            name="priceMax"
            className="money"
            autoComplete="off"
            type="number"
            inputMode="numeric"
            min={0}
            placeholder={high !== undefined ? `до ${high}` : "до"}
            value={priceMax}
            onChange={(event) => setPriceMax(event.currentTarget.value)}
            onBlur={applyPrice}
            onKeyDown={applyOnEnter}
          />
        </div>
        {facets.priceMin && facets.priceMax && (
          <p className="fw__hint">
            У розділі від <span className="money">{formatMoney(facets.priceMin)}</span> до <span className="money">{formatMoney(facets.priceMax)}</span>
          </p>
        )}
      </fieldset>

      {facets.brands.length > 0 && (
        <FacetGroup
          title="Бренд"
          options={facets.brands.map((b) => ({
            key: b.name,
            label: b.name,
            count: b.count,
            checked: selection.brands.includes(b.name),
            name: "brand",
            value: b.name,
            onToggle: () => apply({ brands: toggle(selection.brands, b.name) }),
          }))}
        />
      )}

      {facets.attributes.map((attribute) => (
        <FacetGroup
          key={attribute.name}
          title={attribute.name}
          options={attribute.values.map((v) => {
            const value = `${attribute.name}:${v.value}`;
            return {
              key: value,
              label: v.value,
              count: v.count,
              checked: selection.attrs.includes(value),
              name: "f",
              value,
              onToggle: () => apply({ attrs: toggle(selection.attrs, value) }),
            };
          })}
        />
      ))}

      <noscript>
        <button type="submit" className="btn btn--dark btn--small filters__submit">
          Показати товари
        </button>
      </noscript>
    </form>
  );
}
