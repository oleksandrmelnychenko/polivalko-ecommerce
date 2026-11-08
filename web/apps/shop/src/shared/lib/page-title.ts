import type { Metadata } from "next";

const SHOP_SUFFIX = /poli\s*valko[\s.!?»"')]*$/i;

export function hasShopName(title: string): boolean {
  return SHOP_SUFFIX.test(title.trim());
}

export function pageTitle(title: string): Metadata["title"] {
  const text = title.trim();
  return hasShopName(text) ? { absolute: text } : text;
}
