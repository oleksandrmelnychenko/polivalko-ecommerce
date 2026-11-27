"use client";

import { useEffect, useRef } from "react";
import type { Category } from "@polivalko/shared/api/types";
import Link from "@/shared/ui/idle-link";

export function CategoryChips({ items, current, label, withinCategory = false }: {
  items: Category["children"];
  current?: string;
  label: string;
  withinCategory?: boolean;
}) {
  const list = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const row = list.current;
    const chip = row?.querySelector<HTMLElement>('[aria-current]');
    if (!row || !chip || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft += chip.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - chip.offsetWidth) / 2;
  }, [current]);

  return (
    <nav aria-label={label} className="page-head__subs">
      <span className="category-nav__label">{label}</span>
      <ul className="chips chips--grey" ref={list}>
        {items.map(item => (
          <li key={item.id}>
            <Link href={`/catalog/${item.slug}`} aria-current={current === item.slug ? (withinCategory ? "location" : "page") : undefined}>{item.name}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
