"use client";

import Link from "@/shared/ui/idle-link";
import { useRef, type MouseEvent } from "react";
import { usePathname } from "next/navigation";
import { CategoryLinks, CategoryPicture, containsCategory } from "./mega-column";
import type { MenuCategory } from "../lib/menu-category";
import { ArrowRightIcon, ChevronDownIcon, CloseIcon } from "@polivalko/shared/ui/icons";

export function MobileMenu({ categories, pages }: { categories: MenuCategory[]; pages: { href: string; label: string }[] }) {
  const menu = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  function closeOnNavigate(event: MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("a")) menu.current?.hidePopover();
  }

  return (
    <div id="mobile-menu" ref={menu} popover="auto" className="mega" onClick={closeOnNavigate}>
      <div className="mega__head">
        <p className="mega__title">Каталог</p>
        <Link href="/catalog" className="mega__all">Увесь каталог <ArrowRightIcon /></Link>
        <button type="button" className="icon-btn" popoverTarget="mobile-menu" popoverTargetAction="hide" aria-label="Закрити меню">
          <CloseIcon />
        </button>
      </div>
      <nav aria-label="Розділи каталогу">
        <ul className="mega__grid">
          {categories.map((c) => {
            const head = (
              <>
                <CategoryPicture category={c} />
                <span>{c.name}</span>
              </>
            );
            return (
              <li key={c.id}>
                {c.children.length > 0 ? (
                  <details className="mega__group" name="mobile-catalog-section" open={containsCategory(c, pathname)}>
                    <summary>
                      {head}
                      <ChevronDownIcon />
                    </summary>
                    <div className="mega__subs">
                      <Link href={`/catalog/${c.slug}`} aria-current={pathname === `/catalog/${c.slug}` ? "page" : undefined}>Усі товари розділу <ArrowRightIcon /></Link>
                      <CategoryLinks categories={c.children} pathname={pathname} />
                    </div>
                  </details>
                ) : (
                  <Link href={`/catalog/${c.slug}`} aria-current={pathname === `/catalog/${c.slug}` ? "page" : undefined}>{head}</Link>
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
      </div>
    </div>
  );
}
