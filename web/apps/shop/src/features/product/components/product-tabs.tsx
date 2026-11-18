"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type ProductTab = { id: string; label: string; panel: ReactNode };

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function ProductTabs({ tabs, label }: { tabs: ProductTab[]; label: string }) {
  const base = useId();
  const [active, setActive] = useState(tabs[0]?.id);
  const [glide, setGlide] = useState<{ x: number; w: number } | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const place = useCallback(() => {
    const button = active ? buttons.current.get(active) : undefined;
    if (button) setGlide({ x: button.offsetLeft, w: button.offsetWidth });
  }, [active]);

  useIsoLayoutEffect(place, [place]);

  useEffect(() => {
    window.addEventListener("resize", place);
    document.fonts?.ready.then(place).catch(() => undefined);
    return () => window.removeEventListener("resize", place);
  }, [place]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active);
    const next =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    setActive(tabs[next].id);
    buttons.current.get(tabs[next].id)?.focus();
  };

  return (
    <div className="ptabs">
      <div className="ptabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown} data-ready={glide ? "" : undefined}>
        {glide && <span className="ptabs__glide" aria-hidden="true" style={{ transform: `translateX(${glide.x}px)`, width: glide.w }} />}
        {tabs.map((tab) => (
          <button
            key={tab.id}
            ref={(node) => {
              if (node) buttons.current.set(tab.id, node);
              else buttons.current.delete(tab.id);
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.id}`}
            className="ptabs__tab"
            aria-selected={tab.id === active}
            aria-controls={`${base}-panel-${tab.id}`}
            tabIndex={tab.id === active ? 0 : -1}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.id} role="tabpanel" id={`${base}-panel-${tab.id}`} aria-labelledby={`${base}-tab-${tab.id}`} className="ptabs__panel" hidden={tab.id !== active}>
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
