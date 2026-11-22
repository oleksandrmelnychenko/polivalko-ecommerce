"use client";

import Form from "next/form";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProductListItem } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { hasPrice, PRICE_ON_REQUEST } from "@/shared/lib/price";
import { CloseIcon, SearchIcon } from "@polivalko/shared/ui/icons";

export function SearchButton() {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [result, setResult] = useState<{ query: string; items: ProductListItem[]; failed?: boolean }>({ query: "", items: [] });
  const term = query.trim();
  const loading = term.length >= 2 && result.query !== term;

  useEffect(() => {
    const onPointer = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); setMobileOpen(false); }
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) {
        e.preventDefault(); setMobileOpen(true); setOpen(true); requestAnimationFrame(() => input.current?.focus());
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onPointer); document.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => {
    if (term.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/v1/products?q=${encodeURIComponent(term)}&pageSize=5`, { signal: controller.signal });
        if (!response.ok) throw new Error("search");
        const data = await response.json();
        if (!controller.signal.aborted) setResult({ query: term, items: data.items ?? [] });
      } catch {
        if (!controller.signal.aborted) setResult({ query: term, items: [], failed: true });
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [term]);

  const close = () => { setOpen(false); setMobileOpen(false); };
  return <div ref={root} className="header-search" data-open={mobileOpen} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <button type="button" className="icon-btn header-search__toggle" aria-label={mobileOpen ? "Закрити пошук" : "Пошук"} aria-expanded={mobileOpen} aria-controls="header-search-form" onClick={() => { setMobileOpen(!mobileOpen); setOpen(!mobileOpen); if (!mobileOpen) requestAnimationFrame(() => input.current?.focus()); }}>{mobileOpen ? <CloseIcon /> : <SearchIcon />}</button>
    <Form id="header-search-form" action="/search" role="search" className="header-search__form" onSubmit={close}>
      <SearchIcon />
      <input ref={input} name="q" type="search" value={query} onChange={(e) => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Пошук товарів…" aria-label="Пошук у каталозі" aria-controls={open ? "search-suggestions" : undefined} autoComplete="off" spellCheck={false} enterKeyHint="search" />
      {query && <button type="button" className="header-search__clear" aria-label="Очистити пошук" onClick={() => { setQuery(""); input.current?.focus(); }}><CloseIcon /></button>}
    </Form>
    {open && <div id="search-suggestions" className="search-suggestions">
      {term.length < 2 ? <p className="search-suggestions__message">Введіть щонайменше 2 символи назви або артикулу.</p> : loading ? <p className="search-suggestions__message" role="status">Шукаємо…</p> : result.failed ? <p className="search-suggestions__message" role="status">Пошук тимчасово недоступний. Спробуйте ще раз.</p> : <>
        {result.items.length ? <ul>{result.items.map((p) => <li key={p.id}><Link href={`/product/${p.slug}`} onClick={close}>{p.imageUrl && <img src={p.imageUrl} alt="" width={48} height={56} />}<span><span>{p.name}</span><strong>{hasPrice(p.price) ? formatMoney(p.price) : PRICE_ON_REQUEST}</strong></span></Link></li>)}</ul> : <p className="search-suggestions__message" role="status">Товарів не знайдено.</p>}
        <Link href={`/search?q=${encodeURIComponent(term)}`} className="search-suggestions__all" onClick={close}>Усі результати пошуку</Link>
      </>}
    </div>}
  </div>;
}
