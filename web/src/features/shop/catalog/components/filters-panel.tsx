"use client";

import { useId, useState, type ReactNode } from "react";

export function FiltersPanel({ active, children }: { active: number; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="filters-panel" data-open={open}>
      <button type="button" className="btn btn--quiet btn--small filters-panel__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {open ? "Сховати фільтри" : active > 0 ? `Фільтри: ${active}` : "Фільтри"}
      </button>
      <div id={id} className="filters-panel__body">
        {children}
      </div>
    </div>
  );
}
