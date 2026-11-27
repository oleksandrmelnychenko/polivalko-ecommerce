"use client";

import { useEffect, useRef, type ReactNode } from "react";
import type { Category } from "@polivalko/shared/api/types";
import Link from "@/shared/ui/idle-link";

export function CategoryChips({ items, current, label, children }: { items: Category["children"]; current?: string; label: string; children: ReactNode }) {
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const row = list.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft += chip.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - chip.offsetWidth) / 2;
  }, [current]);

  return (
    <nav aria-label={label} className="page-head__subs">
      <ul className="chips chips--grey" ref={list}>
        {items.map(item => (
          <li key={item.id}>
            <Link href={`/catalog/${item.slug}`} aria-current={current === item.slug ? "page" : undefined}>{item.name}</Link>
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}
