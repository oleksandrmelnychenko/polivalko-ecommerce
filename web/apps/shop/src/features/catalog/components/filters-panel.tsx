"use client";

import { useId, useState, type ReactNode } from "react";
import { AdjustmentsIcon } from "@polivalko/shared/ui/icons";

export function FiltersPanel({ active, children, compact }: { active: number; children: ReactNode; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <div className="filters-panel" data-open={open}>
      <button type="button" className="btn btn--quiet btn--small filters-panel__toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
        {compact && <AdjustmentsIcon />}
        {open ? "Сховати фільтри" : active > 0 ? `Фільтри: ${active}` : "Фільтри"}
      </button>
      <div id={id} className="filters-panel__body">
        <p className="filters-panel__head">{compact && <AdjustmentsIcon />}Фільтри</p>
        {children}
      </div>
    </div>
  );
}
