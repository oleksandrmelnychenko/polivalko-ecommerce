import Link from "next/link";
import type { ProductSearch } from "@polivalko/shared/api/types";
import { pagerCells } from "../lib/pager-cells";

export function ListingPager({ result, href }: { result: ProductSearch; href: (page: number) => string }) {
  if (result.totalPages <= 1) return null;
  return (
    <nav className="pager" aria-label="Сторінки">
      {pagerCells(result.page, result.totalPages).map((cell, index) =>
        cell.kind === "gap" ? (
          <span key={`gap-${index}`} aria-hidden="true" data-show={cell.show}>
            …
          </span>
        ) : cell.current ? (
          <span key={cell.page} aria-current="page">
            {cell.page}
          </span>
        ) : (
          // The wide-screen extras exist to reach distant pages; prefetching them would render pages nobody asked for.
          <Link key={cell.page} href={href(cell.page)} aria-label={`Сторінка ${cell.page}`} data-show={cell.show} prefetch={cell.show === "wide" ? false : undefined}>
            {cell.page}
          </Link>
        ),
      )}
    </nav>
  );
}
