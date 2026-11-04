import Link from "next/link";

export function AccountPager({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1);
  return (
    <nav className="pager" aria-label="Сторінки замовлень">
      {pages.map((n, i) => (
        <span key={n} style={{ display: "contents" }}>
          {i > 0 && n - pages[i - 1] > 1 && <span aria-hidden="true">…</span>}
          {n === page ? (
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
