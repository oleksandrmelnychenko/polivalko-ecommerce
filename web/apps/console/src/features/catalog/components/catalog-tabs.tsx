"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaff } from "@/features/auth";

const tabs = [
  { href: "/catalog", label: "Товари", adminOnly: false },
  { href: "/catalog/categories", label: "Розділи", adminOnly: true },
  { href: "/catalog/collections", label: "Добірки головної", adminOnly: false },
  { href: "/catalog/redirects", label: "Перенаправлення", adminOnly: true },
  { href: "/catalog/import", label: "Імпорт", adminOnly: true },
];

export function CatalogTabs() {
  const pathname = usePathname();
  const { isAdmin } = useStaff();
  return (
    <nav className="console-tabs" aria-label="Розділи каталогу">
      {tabs
        .filter((t) => isAdmin || !t.adminOnly)
        .map((t) => {
          const current = t.href === "/catalog" ? pathname === t.href || pathname.startsWith("/catalog/products") : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={current ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}
