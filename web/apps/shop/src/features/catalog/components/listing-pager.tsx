import Link from "next/link";
import type { ProductSearch } from "@polivalko/shared/api/types";

export function ListingPager({ result, href }: { result: ProductSearch; href: (page: number) => string }) {
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
