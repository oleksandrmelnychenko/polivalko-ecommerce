"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

function subscribe(callback: () => void) {
  const query = matchMedia("(max-width: 40rem)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

export function FooterColumn({ id, title, as = "nav", children }: { id: string; title: string; as?: "nav" | "div"; children: ReactNode }) {
  const Tag = as;
  const mobile = useSyncExternalStore(subscribe, () => matchMedia("(max-width: 40rem)").matches, () => false);
  const [open, setOpen] = useState(false);
  const expanded = !mobile || open;
  return (
    <Tag className="footer__col" aria-labelledby={id}>
      <h2 id={id}><button type="button" className="footer__toggle" aria-expanded={expanded} aria-controls={`${id}-links`} onClick={() => setOpen(!open)} disabled={!mobile}>{title}<span aria-hidden="true">{open ? "−" : "+"}</span></button></h2>
      <div id={`${id}-links`} hidden={!expanded}>{children}</div>
    </Tag>
  );
}
