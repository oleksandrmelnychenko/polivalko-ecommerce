"use client";

import { useLiveStock } from "@/shared/lib/live-stock";

/** «В наявності» / «Немає в наявності» as it is now: the page's value until the live answer arrives. */
export function LiveAvailability({ as: Tag = "span", productId, inStock, className, inClassName, outClassName }: {
  as?: "span" | "p";
  productId: string;
  inStock: boolean;
  className?: string;
  inClassName?: string;
  outClassName?: string;
}) {
  const live = useLiveStock(productId);
  const now = live ? live.inStock : inStock;
  const classes = [className, now ? inClassName : outClassName].filter(Boolean).join(" ") || undefined;
  return (
    <Tag className={classes} data-available={now} aria-live="polite">
      {now ? "В наявності" : "Немає в наявності"}
    </Tag>
  );
}
