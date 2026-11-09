"use client";

import Link from "next/link";
import { useRef, type MouseEvent } from "react";
import { thumb } from "@polivalko/shared/lib/images";
import { ArrowRightIcon, ChevronDownIcon, CloseIcon } from "@polivalko/shared/ui/icons";

type MenuSubcategory = { id: string; slug: string; name: string };
type MenuCategory = { id: string; slug: string; name: string; photo: string | null; children: MenuSubcategory[] };

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
          {categories.map((c) => {
            const head = (
              <>
                {c.photo ? <img src={thumb(c.photo, 120)} alt="" width={56} height={56} loading="lazy" /> : <span className="mega__dot" aria-hidden="true" />}
                <span>{c.name}</span>
              </>
            );
            return (
              <li key={c.id}>
                {c.children.length > 0 ? (
                  <details className="mega__group">
                    <summary>
                      {head}
                      <ChevronDownIcon />
                    </summary>
                    <ul className="mega__subs">
                      <li>
                        <Link href={`/catalog/${c.slug}`}>Усі товари розділу</Link>
                      </li>
                      {c.children.map((child) => (
                        <li key={child.id}>
                          <Link href={`/catalog/${child.slug}`}>{child.name}</Link>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : (
                  <Link href={`/catalog/${c.slug}`}>{head}</Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mega__foot">
        <nav aria-label="Покупцям" className="mega__pages">
          {pages.map((p) => (
            <Link key={p.href} href={p.href}>
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
