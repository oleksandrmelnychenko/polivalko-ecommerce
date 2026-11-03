"use client";

import Form from "next/form";
import { useEffect, useRef } from "react";
import { SearchIcon } from "@/shared/ui/icons";

export function SearchButton() {
  const panel = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      if ((e as ToggleEvent).newState === "open") input.current?.focus();
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || target.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      el.showPopover();
    };
    el.addEventListener("toggle", onToggle);
    document.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("toggle", onToggle);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <>
      <button type="button" className="icon-btn icon-btn--chrome" popoverTarget="search-panel" aria-label="Пошук товарів" aria-keyshortcuts="/">
        <SearchIcon />
      </button>
      <div id="search-panel" ref={panel} popover="auto" className="search-panel">
        <Form action="/search" role="search" className="search" onSubmit={() => panel.current?.hidePopover()}>
          <label htmlFor="site-search" className="visually-hidden">
            Пошук за назвою або артикулом
          </label>
          <SearchIcon />
          <input ref={input} id="site-search" name="q" type="search" placeholder="Назва товару або артикул…" autoComplete="off" spellCheck={false} enterKeyHint="search" />
          <button type="submit" className="btn">
            Знайти
          </button>
        </Form>
        <p className="search-panel__hint">Шукайте за назвою чи артикулом, наприклад «шланг» або DEMO-001.</p>
      </div>
    </>
  );
}
