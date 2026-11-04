"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { thumb } from "@polivalko/shared/lib/images";
import { ArrowRightIcon, CloseIcon } from "@polivalko/shared/ui/icons";

type MenuCategory = { id: string; slug: string; name: string; photo: string | null };

export function MobileMenu({ categories, pages }: { categories: MenuCategory[]; pages: { href: string; label: string }[] }) {
  const menu = useRef<HTMLDivElement>(null);

  function closeOnNavigate(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) menu.current?.hidePopover();
  }

  return (
    <div id="mobile-menu" ref={menu} popover="auto" className="mega" onClick={closeOnNavigate}>
      <div className="mega__head">
        <p className="mega__title">Каталог</p>
        <button type="button" className="icon-btn" popoverTarget="mobile-menu" popoverTargetAction="hide" aria-label="Закрити меню">
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Розділи каталогу">
        <ul className="mega__grid">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/catalog/${c.slug}`}>
                {c.photo ? <img src={thumb(c.photo, 120)} alt="" width={56} height={56} loading="lazy" /> : <span className="mega__dot" aria-hidden="true" />}
                <span>{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mega__foot">
        <nav aria-label="Покупцям" className="mega__pages">
          {pages.map((p) => (
            <Link key={p.label} href={p.href}>
              {p.label}
            </Link>
          ))}
        </nav>
        <Link href="/catalog" className="btn btn--dark btn--small">
          Увесь каталог
          <ArrowRightIcon />
        </Link>
      </div>
    </div>
  );
}
