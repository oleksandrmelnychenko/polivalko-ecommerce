"use client";

import Form from "next/form";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import { CloseIcon, SearchIcon } from "@polivalko/shared/ui/icons";

const SEARCH_PATH = "/search";
const MIN_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function SearchButton() {
  return <Suspense fallback={<SearchField urlQuery="" onSearchPage={false} />}><SearchWithLocation /></Suspense>;
}

function SearchWithLocation() {
  const pathname = usePathname();
  const params = useSearchParams();
  const onSearchPage = pathname === SEARCH_PATH;
  const urlQuery = onSearchPage ? params.get("q")?.trim() ?? "" : "";
  return <SearchField urlQuery={urlQuery} onSearchPage={onSearchPage} />;
}

/**
 * Typing shows the results on the search page itself, not in a dropdown: after a short pause the field opens
 * /search?q=… (a new history entry from another page, a replaced one while typing on the search page).
 */
function SearchField({ urlQuery, onSearchPage }: { urlQuery: string; onSearchPage: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(urlQuery);
  const [mobileOpen, setMobileOpen] = useState(onSearchPage);
  const [pending, startTransition] = useTransition();
  // The query this field last put into the address bar: a different one there came from Back, Forward or a link,
  // and only then does the address overwrite what is typed (never while typing, which would eat letters).
  const [sent, setSent] = useState(urlQuery);
  const [seenUrl, setSeenUrl] = useState(urlQuery);
  if (urlQuery !== seenUrl) {
    setSeenUrl(urlQuery);
    if (urlQuery !== sent) {
      setSent(urlQuery);
      setQuery(urlQuery);
      if (!onSearchPage) setMobileOpen(false);
    }
  }
  const term = query.trim();

  useEffect(() => {
    if (term === sent) return;
    if (term.length < MIN_LENGTH && !(onSearchPage && term.length === 0)) return;
    const timer = setTimeout(() => {
      setSent(term);
      const href = term ? `${SEARCH_PATH}?q=${encodeURIComponent(term)}` : SEARCH_PATH;
      startTransition(() => {
        if (onSearchPage) router.replace(href, { scroll: false });
        else router.push(href);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [term, sent, onSearchPage, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !onSearchPage) setMobileOpen(false);
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !(e.target as HTMLElement).closest("input,textarea,select,[contenteditable]")) {
        e.preventDefault(); setMobileOpen(true); requestAnimationFrame(() => input.current?.focus());
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onSearchPage]);

  return <div className="header-search" data-open={mobileOpen} data-pending={pending || undefined}>
    <button type="button" className="icon-btn header-search__toggle" aria-label={mobileOpen ? "Закрити пошук" : "Пошук"} aria-expanded={mobileOpen} aria-controls="header-search-form"
      onClick={() => { setMobileOpen(!mobileOpen); if (!mobileOpen) requestAnimationFrame(() => input.current?.focus()); }}>{mobileOpen ? <CloseIcon /> : <SearchIcon />}</button>
    <Form id="header-search-form" action={SEARCH_PATH} role="search" className="header-search__form" onSubmit={() => { setSent(term); input.current?.blur(); }}>
      <SearchIcon />
      <input ref={input} name="q" type="search" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Пошук товарів…" aria-label="Пошук у каталозі" autoComplete="off" spellCheck={false} enterKeyHint="search" />
      {query && <button type="button" className="header-search__clear" aria-label="Очистити пошук" onClick={() => { setQuery(""); input.current?.focus(); }}><CloseIcon /></button>}
    </Form>
  </div>;
}
