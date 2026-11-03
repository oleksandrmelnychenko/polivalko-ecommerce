"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const contentLinks = [
  { href: "/admin/content", label: "Сторінки" },
  { href: "/admin/content/contacts", label: "Контакти" },
  { href: "/admin/content/services", label: "Послуги" },
  { href: "/admin/content/pickup", label: "Самовивіз" },
];

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav className="admin-subnav" aria-label="Розділи контенту">
      {contentLinks.map((l) => {
        const current = l.href === "/admin/content" ? pathname === l.href || pathname.startsWith("/admin/content/pages/") : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
