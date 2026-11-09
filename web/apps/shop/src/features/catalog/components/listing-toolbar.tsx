"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { countProducts } from "@polivalko/shared/lib/format";
import { DropdownSelect } from "@/shared/ui/dropdown-select";
import { hrefFor, PAGE_SIZES, SORTS, type Parsed } from "../lib/listing-params";

const SIZE_OPTIONS = PAGE_SIZES.map((n) => ({ value: n, label: countProducts(n) }));

export function ListingToolbar({
  summary,
  parsed,
  basePath,
  fixed,
}: {
  summary: string;
  parsed: Parsed;
  basePath: string;
  fixed: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function go(patch: Partial<Parsed>) {
    const href = hrefFor(basePath, fixed, parsed, { ...patch, page: 1 });
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <div className="toolbar" aria-busy={pending}>
      <p className="toolbar__count" aria-live="polite">
        {summary}
      </p>
      <div className="toolbar__controls">
        <DropdownSelect className="toolbar__sort" label="Сортування" value={parsed.sort} options={SORTS} onChange={(sort) => go({ sort })} />
        <DropdownSelect className="toolbar__size" label="Показувати" value={parsed.pageSize} options={SIZE_OPTIONS} onChange={(pageSize) => go({ pageSize })} />
      </div>
    </div>
  );
}
