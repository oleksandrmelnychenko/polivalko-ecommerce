"use client";

import Form from "next/form";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CloseIcon, SearchIcon } from "@polivalko/shared/ui/icons";
import { SearchSuggestions } from "./search-suggestions";

const SEARCH_PATH = "/search";

function SearchLocation({ onChange }: { onChange: (pathname: string, term: string) => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const term = pathname === SEARCH_PATH ? params.get("q")?.trim() ?? "" : "";
  useEffect(() => onChange(pathname, term), [pathname, term, onChange]);
  return null;
}

export function SearchButton() {
  const root = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const [query, setQuery] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const location = useRef<string | null>(null);
  const syncLocation = useCallback((pathname: string, urlQuery: string) => {
    const key = JSON.stringify([pathname, urlQuery]);
    if (location.current === key) return;
    const initial = location.current === null;
    location.current = key;
    if (initial && pathname !== SEARCH_PATH) return;
    setQuery(current => initial && current ? current : urlQuery);
    setMobileOpen(pathname === SEARCH_PATH);
    if (!initial) setExpanded(false);
  }, []);
  const term = query.trim();
  const showResults = expanded && term.length >= 2;

  useEffect(() => {
    function shortcut(event: globalThis.KeyboardEvent) {
      if (event.key !== "/" || event.ctrlKey || event.metaKey || event.altKey ||
          (event.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) return;
      event.preventDefault();
      setMobileOpen(true);
      requestAnimationFrame(() => input.current?.focus());
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setExpanded(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded]);

  function handleKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (showResults) {
        input.current?.focus();
        setExpanded(false);
      } else if (toggle.current?.offsetWidth) {
        setMobileOpen(false);
        toggle.current.focus();
      }
      return;
    }
    if (!showResults || (event.key !== "ArrowDown" && event.key !== "ArrowUp")) return;
    const controls = Array.from(root.current!.querySelectorAll<HTMLElement>(".header-search__results a, .header-search__results button"));
    const index = controls.indexOf(event.target as HTMLElement);
    if (event.target !== input.current && index === -1) return;
    event.preventDefault();
    const next = event.key === "ArrowDown" ? index + 1 : index - 1;
    (controls[next] ?? input.current)?.focus();
  }

  return <div ref={root} className="header-search" data-open={mobileOpen} onKeyDown={handleKey}
    onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setExpanded(false); }}>
    <Suspense fallback={null}><SearchLocation onChange={syncLocation} /></Suspense>
    <button ref={toggle} type="button" className="icon-btn header-search__toggle" aria-label={mobileOpen ? "Закрити пошук" : "Пошук"}
      aria-expanded={mobileOpen} aria-controls="header-search-form" onClick={() => {
        setMobileOpen(!mobileOpen);
        setExpanded(false);
        if (!mobileOpen) requestAnimationFrame(() => input.current?.focus());
      }}>{mobileOpen ? <CloseIcon /> : <SearchIcon />}</button>
    <Form id="header-search-form" action={SEARCH_PATH} role="search" className="header-search__form"
      onSubmit={event => { if (!term) event.preventDefault(); setExpanded(false); }}>
      <SearchIcon />
      <input ref={input} name="q" type="search" value={query} aria-controls={showResults ? "header-search-results" : undefined}
        onChange={e => { setQuery(e.target.value); setExpanded(true); }} onFocus={() => setExpanded(true)} onClick={() => setExpanded(true)}
        placeholder="Пошук товарів…" aria-label="Пошук у каталозі" autoComplete="off" spellCheck={false} enterKeyHint="search" />
      {query && <button type="button" className="header-search__clear" aria-label="Очистити пошук" onClick={() => { setQuery(""); input.current?.focus(); }}><CloseIcon /></button>}
      {showResults && <SearchSuggestions term={term} onSelect={() => setExpanded(false)} />}
    </Form>
  </div>;
}
