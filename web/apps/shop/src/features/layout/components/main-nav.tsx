"use client";

import Link from "@/shared/ui/idle-link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRightIcon, ChevronDownIcon, ChevronRightIcon, GridIcon } from "@polivalko/shared/ui/icons";
import { CategoryLinks, CategoryPicture, containsCategory } from "./mega-column";
import type { MenuCategory } from "../lib/menu-category";

import { GardenServicesIcon } from "@polivalko/shared/ui/service-icon";
import type { NavLink, ServiceNavLink } from "../lib/nav-links";
import { NavItemLink } from "./nav-item-link";
import { ServiceMenuLinks } from "./service-menu-links";

type Panel = "catalog" | "services";
type MenuState = { panel: Panel; pinned: boolean } | null;

export function MainNav({ categories, links, services }: { categories: MenuCategory[]; links: NavLink[]; services: ServiceNavLink[] }) {
  const pathname = usePathname();
  const current = categories.find(category => containsCategory(category, pathname));
  const [selected, setSelected] = useState("");
  const [menu, setMenu] = useState<MenuState>(null);
  const item = useRef<HTMLLIElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const serviceItem = useRef<HTMLLIElement>(null);
  const serviceTrigger = useRef<HTMLButtonElement>(null);
  const active = categories.find(category => category.slug === selected) ?? current ?? categories[0];
  const open = menu?.panel === "catalog";
  const servicesOpen = menu?.panel === "services";
  const panel = menu?.panel;

  function hover(which: Panel) {
    setMenu(previous => previous?.panel === which ? previous : { panel: which, pinned: false });
  }

  function toggle(which: Panel) {
    setMenu(previous => previous?.panel === which && previous.pinned ? null : { panel: which, pinned: true });
  }

  useEffect(() => {
    if (!panel) return;
    const root = panel === "catalog" ? item : serviceItem;
    const button = panel === "catalog" ? trigger : serviceTrigger;
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setMenu(null);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setMenu(null);
      if (root.current?.contains(document.activeElement)) button.current?.focus();
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [panel]);

  return (
    <nav className="site-nav" aria-label="Головне меню">
      <ul className="site-nav__list">
        <li ref={item} className="nav-item nav-item--mega"
          onPointerEnter={event => { if (event.pointerType === "mouse" && !open) { setSelected(""); hover("catalog"); } }}
          onPointerLeave={() => { if (open && !menu?.pinned && !item.current?.contains(document.activeElement)) setMenu(null); }}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null); }}>
          {active ? <>
            <button type="button" ref={trigger} className="nav-link catalog-trigger" aria-expanded={open} aria-controls="catalog-panel"
              data-current={pathname.startsWith("/catalog") || undefined}
              onClick={() => { if (!open) setSelected(""); toggle("catalog"); }}>
              <GridIcon />Каталог<ChevronDownIcon />
            </button>
            <div id="catalog-panel" className="catalog-panel" hidden={!open}
              onClick={event => { if ((event.target as Element).closest("a")) setMenu(null); }}>
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
        {links.map(link => link.href === "/services" && services.length > 0 ? (
          <li key={link.href} ref={serviceItem} className="nav-item"
            onPointerEnter={event => { if (event.pointerType === "mouse") hover("services"); }}
            onPointerLeave={() => { if (servicesOpen && !menu?.pinned && !serviceItem.current?.contains(document.activeElement)) setMenu(null); }}
            onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setMenu(null); }}>
            <button type="button" ref={serviceTrigger} className="nav-link catalog-trigger"
              aria-controls="service-panel" aria-expanded={servicesOpen}
              data-current={pathname === link.href || pathname.startsWith(link.href + "/") || undefined}
              onClick={() => toggle("services")}>
              <GardenServicesIcon aria-hidden="true" stroke={1.75} />{link.label}<ChevronDownIcon />
            </button>
            <div id="service-panel" className="service-panel" hidden={!servicesOpen}
              onClick={event => { if ((event.target as Element).closest("a")) setMenu(null); }}>
              <Link href={link.href} className="catalog-panel__all" aria-current={pathname === link.href ? "page" : undefined}>
                Усі послуги <ArrowRightIcon />
              </Link>
              <ServiceMenuLinks services={services} pathname={pathname} />
            </div>
          </li>
        ) : <NavItemLink key={link.href} {...link} />)}
      </ul>
    </nav>
  );
}
