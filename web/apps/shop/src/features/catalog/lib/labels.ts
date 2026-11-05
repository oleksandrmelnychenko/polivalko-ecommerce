import type { components } from "@polivalko/shared/api/schema";

export type ProductLabel = components["schemas"]["ProductLabelBadgeDto"];

const RIBBON_MAX = 10;

export function splitRibbon(labels: ProductLabel[]): { ribbon?: ProductLabel; rest: ProductLabel[] } {
  const [first, ...rest] = labels;
  return first && first.name.length <= RIBBON_MAX ? { ribbon: first, rest } : { rest: labels };
}
