"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CircleCheckIcon, ComparisonBarsIcon } from "@polivalko/shared/ui/icons";
import { addComparison, removeComparison, useComparison } from "./store";
import type { CompareProduct } from "./model";
import { notifyComparison } from "./notice";
export type { CompareProduct } from "./model";
export { CompareScreen } from "./screen";
export function CompareIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="9" width="6" height="11" rx="1" /><rect x="14" y="4" width="6" height="16" rx="1" /></svg>;
}

export function CompareLink() {
  const products = useComparison();
  return <Link href="/compare" prefetch={false} className="icon-btn icon-btn--chrome compare-link" title="Перейти до порівняння" aria-label={`Порівняти товари: ${products.length}`}><ComparisonBarsIcon />{products.length > 0 && <span className="cart-button__count">{products.length}</span>}</Link>;
}

export function CompareButton({ product, text = false, showLink = false }: { product: CompareProduct; text?: boolean; showLink?: boolean }) {
  const products = useComparison();
  const selected = products.some(p => p.id === product.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef(false);
  async function toggle() {
    if (pending.current) return;
    setError(null);
    if (selected) { removeComparison(product.id); return; }
    pending.current = true;
    setBusy(true);
    try { await addComparison(product); }
    catch (err) {
      const message = err instanceof Error ? err.message : "Не вдалося додати товар. Спробуйте ще раз.";
      setError(message);
      notifyComparison({ kind: "error", name: product.name, message });
    }
    finally { pending.current = false; setBusy(false); }
  }
  const label = selected ? "Прибрати з порівняння" : "Додати до порівняння";
  const button = <button type="button" className={text ? "compare-toggle compare-toggle--text" : "round-btn compare-toggle"} aria-pressed={selected} aria-label={`${label}: ${product.name}`} title={label} disabled={busy} aria-busy={busy} onClick={() => void toggle()}>{selected && text ? <CircleCheckIcon /> : <CompareIcon />}{text && (busy ? "Додаємо…" : selected ? "У порівнянні" : label)}</button>;
  return <div className={showLink ? "compare-actions" : "compare-control"}>{button}{showLink && selected && <Link href="/compare" prefetch={false} className="compare-actions__link">Перейти до порівняння →</Link>}{error && <div className="compare-control__feedback" role="alert"><p className="compare-control__error">{error}</p><Link href="/compare" className="compare-actions__link">Перейти до порівняння →</Link></div>}</div>;
}
