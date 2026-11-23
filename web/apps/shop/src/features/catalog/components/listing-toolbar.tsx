"use client";

import { countProducts } from "@polivalko/shared/lib/format";
import { DropdownSelect } from "@/shared/ui/dropdown-select";
import { PAGE_SIZES, SORTS } from "../lib/listing-params";
import { useListingNavigation } from "./listing-navigation";

const SIZE_OPTIONS = PAGE_SIZES.map((n) => ({ value: n, label: countProducts(n) }));

export function ListingToolbar({ summary }: { summary: string }) {
  const { pending, selection, apply } = useListingNavigation();

  return (
    <div className="toolbar" aria-busy={pending}>
      <p className="toolbar__count" aria-live="polite">
        {summary}
      </p>
      <div className="toolbar__controls">
        <DropdownSelect className="toolbar__sort" label="Сортування" value={selection.sort} options={SORTS} onChange={(sort) => apply({ sort })} />
        <DropdownSelect className="toolbar__size" label="Показувати" value={selection.pageSize} options={SIZE_OPTIONS} onChange={(pageSize) => apply({ pageSize })} />
      </div>
    </div>
  );
}
