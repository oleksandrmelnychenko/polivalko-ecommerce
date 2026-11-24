import type { components } from "@polivalko/shared/api/schema";

export type ProductLabel = components["schemas"]["ProductLabelBadgeDto"];

/** Автоматична «Акція» повторює плашку «−X%»: коли знижку видно відсотком, мітку не показуємо. */
export function withoutSaleLabel(labels: ProductLabel[], discountShown: boolean): ProductLabel[] {
  return discountShown ? labels.filter((label) => label.kind !== "sale") : labels;
}
