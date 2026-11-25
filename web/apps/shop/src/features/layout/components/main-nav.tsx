"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, GridIcon } from "@polivalko/shared/ui/icons";
import { CategoryLinks, CategoryPicture, containsCategory } from "./mega-column";
import type { MenuCategory } from "../lib/menu-category";

export function MainNav({ categories, children }: { categories: MenuCategory[]; children: ReactNode }) {
  const pathname = usePathname();
  const current = categories.find(category => containsCategory(category, pathname));
  const [selected, setSelected] = useState("");
  const [mode, setMode] = useState<"closed" | "hover" | "open">("closed");
  const item = useRef<HTMLLIElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const active = categories.find(category => category.slug === selected) ?? current ?? categories[0];
  const open = mode !== "closed";

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!item.current?.contains(event.target as Node)) setMode("closed");
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMode("closed");
      if (item.current?.contains(document.activeElement)) trigger.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <nav className="site-nav" aria-label="Головне меню">
      <ul className="site-nav__list">
        <li ref={item} className="nav-item nav-item--mega"
          onPointerEnter={event => { if (event.pointerType === "mouse" && !open) { setSelected(""); setMode("hover"); } }}
          onPointerLeave={() => { if (mode === "hover" && !item.current?.contains(document.activeElement)) setMode("closed"); }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMode("closed"); }}>
          {active ? <>
            <button type="button" ref={trigger} className="nav-link catalog-trigger" aria-expanded={open} aria-controls="catalog-panel"
              data-current={pathname.startsWith("/catalog") || undefined}
              onClick={() => { if (!open) setSelected(""); setMode(mode === "open" ? "closed" : "open"); }}>
              <GridIcon />Каталог<ChevronDownIcon />
            </button>
            <div id="catalog-panel" className="catalog-panel" hidden={!open}
              onClick={event => { if ((event.target as Element).closest("a")) setMode("closed"); }}>
              <div className="catalog-panel__rail">
                <Link href="/catalog" className="catalog-panel__all">Увесь каталог <ArrowRightIcon /></Link>
                {categories.map(category => (
                  <Link key={category.id} href={`/catalog/${category.slug}`} className="catalog-panel__category"
                    aria-current={pathname === `/catalog/${category.slug}` ? "page" : undefined}
                    data-active={category.id === active.id || undefined}
                    aria-controls="catalog-section"
                    onPointerEnter={event => { if (event.pointerType === "mouse") setSelected(category.slug); }}
                    onFocus={() => setSelected(category.slug)}>
                    <CategoryPicture category={category} />{category.name}<ChevronRightIcon />
                  </Link>
                ))}
              </div>
              <section id="catalog-section" className="catalog-panel__section" aria-labelledby="catalog-section-name">
                <div className="catalog-panel__head">
                  <h2 id="catalog-section-name">{active.name}</h2>
                  <Link href={`/catalog/${active.slug}`}>Усі товари розділу <ArrowRightIcon /></Link>
                </div>
                <CategoryLinks categories={active.children} pathname={pathname} />
              </section>
            </div>
          </> : <Link href="/catalog" className="nav-link">Каталог</Link>}
        </li>
        {children}
      </ul>
    </nav>
  );
}
