"use client";

import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { SearchIcon } from "@polivalko/shared/ui/icons";
import { search } from "../api/client";
import { paletteGroups, type PaletteItem, type PaletteSection, type SearchResult } from "../lib/palette-items";
import { PaletteResults } from "./palette-results";

export function CommandPalette({ sections }: { sections: PaletteSection[] }) {
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
    window.addEventListener("console:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("console:search", onOpen);
    };
  }, []);

  const term = q.trim();
  useEffect(() => {
    if (term.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void search(term).then(({ data }) => {
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

  const groups = paletteGroups(term, sections, result);
  const items = groups.flatMap((g) => g.items);
  const searching = term.length >= 2 && result?.q !== term;

  function go(item: PaletteItem | undefined) {
    if (!item) return;
    dialog.current?.close();
    router.push(item.href);
  }

  return (
    <dialog
      ref={dialog}
      className="palette"
      aria-label="Пошук по консолі"
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
      <PaletteResults groups={groups} active={active} term={term} searching={searching} empty={items.length === 0} onActive={setActive} onPick={go} />
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
