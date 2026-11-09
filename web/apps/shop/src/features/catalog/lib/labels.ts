import type { components } from "@polivalko/shared/api/schema";

export type ProductLabel = components["schemas"]["ProductLabelBadgeDto"];

const RIBBON_MAX = 10;

export function splitRibbon(labels: ProductLabel[]): { ribbon?: ProductLabel; rest: ProductLabel[] } {
  const [first, ...rest] = labels;
  return first && first.name.length <= RIBBON_MAX ? { ribbon: first, rest } : { rest: labels };
}

/** Автоматична «Акція» повторює плашку «−X%»: коли знижку видно відсотком, мітку не показуємо. */
export function withoutSaleLabel(labels: ProductLabel[], discountShown: boolean): ProductLabel[] {
  return discountShown ? labels.filter((label) => label.kind !== "sale") : labels;
}
