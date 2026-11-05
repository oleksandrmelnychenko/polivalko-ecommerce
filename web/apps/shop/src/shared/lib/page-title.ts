import type { Metadata } from "next";

const SHOP_SUFFIX = /poli\s*valko[\s.!?»"')]*$/i;

export function pageTitle(title: string): Metadata["title"] {
  const text = title.trim();
  return SHOP_SUFFIX.test(text) ? { absolute: text } : text;
}
