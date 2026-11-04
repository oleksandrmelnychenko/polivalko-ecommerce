"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const contentLinks = [
  { href: "/content", label: "Сторінки" },
  { href: "/content/contacts", label: "Контакти" },
  { href: "/content/services", label: "Послуги" },
  { href: "/content/pickup", label: "Самовивіз" },
];

export function ContentNav() {
  const pathname = usePathname();
  return (
    <nav className="console-subnav" aria-label="Розділи контенту">
      {contentLinks.map((l) => {
        const current = l.href === "/content" ? pathname === l.href || pathname.startsWith("/content/pages/") : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} aria-current={current ? "page" : undefined}>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
