"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type CollectionTab = { key: string; label: string; panel: ReactNode };

export function CollectionTabs({ tabs, label }: { tabs: CollectionTab[]; label: string }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const base = useId();

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.key === active);
    const next =
      event.key === "ArrowRight" ? (index + 1) % tabs.length
      : event.key === "ArrowLeft" ? (index - 1 + tabs.length) % tabs.length
      : event.key === "Home" ? 0
      : event.key === "End" ? tabs.length - 1
      : -1;
    if (next < 0) return;
    event.preventDefault();
    setActive(tabs[next].key);
    buttons.current.get(tabs[next].key)?.focus();
  };

  return (
    <div className="ctabs">
      <div className="ctabs__list" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={(node) => {
              if (node) buttons.current.set(tab.key, node);
              else buttons.current.delete(tab.key);
            }}
            type="button"
            role="tab"
            id={`${base}-tab-${tab.key}`}
            className="ctabs__tab"
            aria-selected={tab.key === active}
            aria-controls={`${base}-panel-${tab.key}`}
            tabIndex={tab.key === active ? 0 : -1}
            onClick={() => setActive(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" id={`${base}-panel-${tab.key}`} aria-labelledby={`${base}-tab-${tab.key}`} hidden={tab.key !== active}>
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
