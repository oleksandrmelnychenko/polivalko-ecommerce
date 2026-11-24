"use client";

import { useEffect, useRef, useState } from "react";
import { CircleCheckIcon, ClipboardIcon } from "@polivalko/shared/ui/icons";

export function CopySkuTag({ sku }: { sku: string }) {
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(sku);
      setNotice("Скопійовано");
    } catch {
      setNotice("Не вдалося скопіювати");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(""), 2000);
  }

  return (
    <button type="button" className="product-meta-tag" onClick={copy} aria-label={`Скопіювати артикул ${sku}`} title="Скопіювати артикул">
      Артикул <strong translate="no">{sku}</strong>
      {notice === "Скопійовано" ? <CircleCheckIcon /> : <ClipboardIcon />}
      <span role="status" className={notice === "Не вдалося скопіювати" ? "product-meta-tag__notice" : "visually-hidden"}>{notice}</span>
    </button>
  );
}
