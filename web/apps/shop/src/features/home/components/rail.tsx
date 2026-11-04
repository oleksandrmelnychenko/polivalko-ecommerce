"use client";

import { useRef, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@polivalko/shared/ui/icons";

export function Rail({ label, children }: { label: string; children: ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const scroll = (direction: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.9, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <div className="rail">
      <button type="button" className="rail__arrow rail__arrow--prev" onClick={() => scroll(-1)} aria-label={`Попередні: ${label}`}>
        <ChevronLeftIcon />
      </button>
      <div ref={track} className="rail__track" role="region" aria-label={label} tabIndex={0}>
        {children}
      </div>
      <button type="button" className="rail__arrow rail__arrow--next" onClick={() => scroll(1)} aria-label={`Наступні: ${label}`}>
        <ChevronRightIcon />
      </button>
    </div>
  );
}
