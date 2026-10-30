"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { BagIcon, SearchIcon, TagIcon, UserIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatDateTime, formatMoney } from "@/lib/format";
import { orderStatusLabel } from "@/lib/labels";

type SearchResult = components["schemas"]["AdminSearchDto"];
type Item = { key: string; href: string; icon: ReactNode; image?: string | null; title: string; sub: string; side?: string };

/**
 * Пошук по всій адмінці (Ctrl+K або «/»): замовлення за номером і телефоном, товари за назвою й артикулом,
 * покупці. Без запиту — перехід до розділів. Стрілки вибирають, Enter відкриває.
 */
export function CommandPalette({ sections }: { sections: { href: string; label: string; icon: ReactNode }[] }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ q: string; data: SearchResult | null } | null>(null);
  const [active, setActive] = useState(0);

  const open = useEffectEvent(() => {
    if (dialog.current?.open) return;
    setQ("");
    setResult(null);
    setActive(0);
    dialog.current?.showModal();
    input.current?.focus();
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName));
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !typing)) {
        e.preventDefault();
        open();
      }
    };
    const onOpen = () => open();
    window.addEventListener("keydown", onKey);
    window.addEventListener("admin:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("admin:search", onOpen);
    };
  }, []);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void browserApi.GET("/api/v1/admin/search", { params: { query: { q: term } } }).then(({ data }) => {
        if (!cancelled) {
          setResult({ q: term, data: data ?? null });
          setActive(0);
        }
      });
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [term]);

  const groups: { title: string; items: Item[] }[] = [];
  if (term.length < 2) {
    groups.push({
      title: "Перейти",
      items: sections.map((s) => ({ key: s.href, href: s.href, icon: s.icon, title: s.label, sub: s.href })),
    });
  } else if (result?.data && result.q === term) {
    const { orders, products, customers } = result.data;
    if (orders.length)
      groups.push({
        title: "Замовлення",
        items: orders.map((o) => ({
          key: `o-${o.number}`,
          href: `/admin/orders/${o.number}`,
          icon: <BagIcon />,
          title: `${o.number} · ${o.customerName}`,
          sub: `${orderStatusLabel[o.status]} · ${formatDateTime(o.createdAt)} · ${o.phone}`,
          side: formatMoney(o.total),
        })),
      });
    if (products.length)
      groups.push({
        title: "Товари",
        items: products.map((p) => ({
          key: `p-${p.id}`,
          href: `/admin/catalog/products/${p.id}`,
          icon: <TagIcon />,
          image: p.imageUrl,
          title: p.name,
          sub: `${p.sku}${p.isVisible ? "" : " · прихований"}`,
          side: formatMoney(p.price),
        })),
      });
    if (customers.length)
      groups.push({
        title: "Покупці",
        items: customers.map((c) => ({
          key: `c-${c.phone}`,
          href: `/admin/orders?q=${encodeURIComponent(c.phone)}`,
          icon: <UserIcon />,
          title: c.name,
          sub: c.phone,
          side: `${c.orders} замовл.`,
        })),
      });
  }
  const items = groups.flatMap((g) => g.items);
  const searching = term.length >= 2 && result?.q !== term;

  function go(item: Item | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  let index = -1;
  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Пошук по адмінці"
      onClick={(e) => e.target === e.currentTarget && dialog.current?.close()}
    >
      <div className="palette__bar">
        <SearchIcon />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              if (items.length) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length);
            } else if (e.key === "Enter") {
              e.preventDefault();
              go(items[active]);
            }
          }}
          placeholder="Номер замовлення, телефон, товар або артикул…"
          aria-label="Що шукаємо"
          role="combobox"
          aria-expanded={items.length > 0}
          aria-controls="palette-list"
          aria-activedescendant={items[active] ? `palette-${items[active].key}` : undefined}
          autoComplete="off"
          spellCheck={false}
        />
        <span className="kbd">Esc</span>
      </div>
      <div className="palette__body" id="palette-list" role="listbox" aria-label="Результати">
        {groups.map((g) => (
          <div key={g.title} className="palette__group" role="group" aria-label={g.title}>
            <p className="palette__title" aria-hidden="true">
              {g.title}
            </p>
            {g.items.map((item) => {
              index += 1;
              const i = index;
              return (
                <div
                  key={item.key}
                  id={`palette-${item.key}`}
                  className="palette__item"
                  role="option"
                  aria-selected={i === active}
                  onPointerMove={() => setActive(i)}
                  onClick={() => go(item)}
                >
                  {item.image ? <img src={item.image} alt="" /> : <span className="palette__icon">{item.icon}</span>}
                  <span className="palette__main">
                    <strong>{item.title}</strong>
                    <span>{item.sub}</span>
                  </span>
                  {item.side && <span className="palette__side">{item.side}</span>}
                </div>
              );
            })}
          </div>
        ))}
        {term.length >= 2 && !searching && items.length === 0 && <p className="palette__empty">Нічого не знайдено за «{term}».</p>}
        {searching && <p className="palette__empty">Шукаємо…</p>}
      </div>
      <div className="palette__foot" aria-hidden="true">
        <span>
          <span className="kbd">↑</span>
          <span className="kbd">↓</span> вибрати
        </span>
        <span>
          <span className="kbd">Enter</span> відкрити
        </span>
        <span>
          <span className="kbd">Ctrl K</span> або <span className="kbd">/</span> з будь-якої сторінки
        </span>
      </div>
    </dialog>
  );
}
