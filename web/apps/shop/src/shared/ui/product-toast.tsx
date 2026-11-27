"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertIcon, ArrowRightIcon, CloseIcon } from "@polivalko/shared/ui/icons";
import { PRODUCT_NOTICE, type ProductNotice } from "./product-notice";

export function ProductToast() {
  const [notice, setNotice] = useState<ProductNotice | null>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [closing, setClosing] = useState(false);
  const [sequence, setSequence] = useState(0);
  function dismiss() { setClosing(true); setHovered(false); setFocused(false); }
  useEffect(() => {
    const show = (event: Event) => {
      setNotice((event as CustomEvent<ProductNotice>).detail);
      setSequence(value => value + 1);
      setClosing(false);
      setHovered(false);
      setFocused(false);
    };
    window.addEventListener(PRODUCT_NOTICE, show);
    return () => window.removeEventListener(PRODUCT_NOTICE, show);
  }, []);
  useEffect(() => {
    if (!notice || hovered || focused || closing) return;
    const timer = window.setTimeout(() => setClosing(true), 5000);
    return () => window.clearTimeout(timer);
  }, [notice, hovered, focused, closing]);
  useEffect(() => {
    if (!closing) return;
    const timer = window.setTimeout(() => setNotice(null), 200);
    return () => window.clearTimeout(timer);
  }, [closing, notice]);

  return <div className="compare-toast-region" role="status" aria-live="polite" aria-atomic="true">
    {notice && <div key={sequence} className="compare-toast" data-kind={notice.kind} data-closing={closing} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)} onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
      <span className="compare-toast__icon" aria-hidden="true">
        {notice.kind === "error" ? <AlertIcon /> : notice.kind === "added" ? "+" : "−"}
      </span>
      <div className="compare-toast__body">
        <strong>{notice.title}</strong>
        <p>{notice.message}</p>
        {notice.action && <Link href={notice.action.href} onClick={dismiss}>
          {notice.action.label} <ArrowRightIcon />
        </Link>}
      </div>
      <button type="button" className="compare-toast__close" aria-label="Закрити повідомлення" onClick={dismiss}><CloseIcon /></button>
    </div>}
  </div>;
}
