"use client";

import { useId, useState, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { CircleCheckIcon, GridIcon, TagIcon, WalletIcon } from "@polivalko/shared/ui/icons";
import type { ProductSearch } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import * as Slider from "@radix-ui/react-slider";
import { priceOrder } from "../lib/listing-params";
import { useListingNavigation } from "./listing-navigation";

const LIST_LIMIT = 6;
const SEARCH_FROM = 9;

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

const priceOf = (text: string) => {
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

type Option = { key: string; label: string; count?: number; checked: boolean; name: string; value: string; onToggle: () => void; };

function FacetGroup({ title, options, icon }: { title: string; options: Option[]; icon?: ReactNode }) {
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
      <legend className="fw__title">{icon}{title}</legend>
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
      {needle && matching.length === 0 && <p className="fw__empty">Збігів не знайдено</p>}
      {!needle && (hidden > 0 || expanded) && matching.length > LIST_LIMIT && (
        <button type="button" className="fw__more" aria-expanded={expanded} onClick={() => setExpanded((e) => !e)}>
          {expanded ? "Згорнути" : `Ще ${hidden}`}
        </button>
      )}
    </fieldset>
  );
}

export function ListingFilters({
  facets,
  basePath,
  fixed,
  saleOnly = false,
  compact,
}: {
  // Only the facets cross into the client: the listed products would be serialized into the payload a second time.
  facets: ProductSearch["facets"];
  basePath: string;
  fixed: Record<string, string>;
  saleOnly?: boolean;
  compact: boolean;
}) {
  const { selection, pending, apply } = useListingNavigation();
  const minValue = selection.priceMin?.toString() ?? "";
  const maxValue = selection.priceMax?.toString() ?? "";
  const [priceMin, setPriceMin] = useState(minValue);
  const [priceMax, setPriceMax] = useState(maxValue);
  const rangeKey = minValue + "/" + maxValue;
  const [previousRange, setPreviousRange] = useState(rangeKey);
  if (rangeKey !== previousRange) {
    setPreviousRange(rangeKey);
    setPriceMin(minValue);
    setPriceMax(maxValue);
  }

  function applyPrice() {
    const [min, max] = priceOrder(priceOf(priceMin), priceOf(priceMax));
    setPriceMin(min ? String(min) : "");
    setPriceMax(max ? String(max) : "");
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
  const priceId = useId();
  const hasRange = low !== undefined && high !== undefined && low < high;

  function sliderPrices([from, to]: number[]) {
    return { priceMin: from === low ? undefined : from, priceMax: to === high ? undefined : to };
  }

  const availability: Option[] = [
    { key: "inStock", label: "Лише в наявності", count: facets.inStockCount, checked: selection.inStock, name: "inStock", value: "true", onToggle: () => apply({ inStock: !selection.inStock }) },
    { key: "onSale", label: "Зі знижкою", checked: selection.onSale, name: "onSale", value: "true", onToggle: () => apply({ onSale: !selection.onSale }) },
  ].filter((option) => !(saleOnly && option.key === "onSale"));

  return (
    <form action={basePath} className="filters" aria-label="Фільтри" aria-busy={pending} onSubmit={submit}>
      {Object.entries(fixed).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      {selection.sort !== "recommended" && <input type="hidden" name="sort" value={selection.sort} />}

      <FacetGroup title="Наявність" options={availability} icon={compact && <CircleCheckIcon />} />

      <fieldset className="fw">
        <legend className="fw__title">{compact && <WalletIcon />}Ціна, ₴</legend>
        <div className="range">
          <label className="visually-hidden" htmlFor={`${priceId}-min`}>
            Ціна від
          </label>
          <input
            id={`${priceId}-min`}
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
          <label className="visually-hidden" htmlFor={`${priceId}-max`}>
            Ціна до
          </label>
          <input
            id={`${priceId}-max`}
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
        {hasRange && (
          <Slider.Root
            className="price-slider"
            min={low}
            max={high}
            value={[
              Math.min(high, Math.max(low, priceOf(priceMin) ?? low)),
              Math.min(high, Math.max(low, priceOf(priceMax) ?? high)),
            ]}
            onValueChange={(values) => {
              const bounds = sliderPrices(values);
              setPriceMin(bounds.priceMin?.toString() ?? "");
              setPriceMax(bounds.priceMax?.toString() ?? "");
            }}
            onValueCommit={(values) => apply(sliderPrices(values))}
          >
            <Slider.Track className="price-slider__track"><Slider.Range className="price-slider__fill" /></Slider.Track>
            <Slider.Thumb className="price-slider__thumb" aria-label="Мінімальна ціна, грн" />
            <Slider.Thumb className="price-slider__thumb" aria-label="Максимальна ціна, грн" />
          </Slider.Root>
        )}
        {!compact && facets.priceMin && facets.priceMax && (
          <p className="fw__hint">
            У розділі від <span className="money">{formatMoney(facets.priceMin)}</span> до <span className="money">{formatMoney(facets.priceMax)}</span>
          </p>
        )}
      </fieldset>

      {/* One brand is no choice: on a brand page, or in a section that sells one brand. */}
      {facets.brands.length > 1 && (
        <FacetGroup
          title="Бренд"
          icon={compact && <TagIcon />}
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
          icon={compact && <GridIcon />}
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
