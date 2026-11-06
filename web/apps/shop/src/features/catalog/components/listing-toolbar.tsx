"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { hrefFor, PAGE_SIZES, SORTS, type Parsed } from "../lib/listing-params";

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
        <label className="tsel" htmlFor="listing-sort">
          <span>Сортування</span>
          <select id="listing-sort" value={parsed.sort} onChange={(e) => go({ sort: e.currentTarget.value })}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="tsel" htmlFor="listing-size">
          <span>Показувати</span>
          <select id="listing-size" value={parsed.pageSize} onChange={(e) => go({ pageSize: Number(e.currentTarget.value) })}>
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
