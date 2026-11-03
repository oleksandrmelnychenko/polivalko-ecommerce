"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useStaff } from "@/features/admin/auth";

const tabs = [
  { href: "/admin/catalog", label: "Товари", adminOnly: false },
  { href: "/admin/catalog/categories", label: "Розділи", adminOnly: true },
  { href: "/admin/catalog/collections", label: "Добірки головної", adminOnly: false },
  { href: "/admin/catalog/redirects", label: "Перенаправлення", adminOnly: true },
  { href: "/admin/catalog/import", label: "Імпорт", adminOnly: true },
];

export function CatalogTabs() {
  const pathname = usePathname();
  const { isAdmin } = useStaff();
  return (
    <nav className="admin-tabs" aria-label="Розділи каталогу">
      {tabs
        .filter((t) => isAdmin || !t.adminOnly)
        .map((t) => {
          const current = t.href === "/admin/catalog" ? pathname === t.href || pathname.startsWith("/admin/catalog/products") : pathname.startsWith(t.href);
          return (
            <Link key={t.href} href={t.href} aria-current={current ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
    </nav>
  );
}
