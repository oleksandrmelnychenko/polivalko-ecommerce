import type { Money } from "@polivalko/shared/api/types";

export function discountPercent(price: Money, oldPrice?: Money | null): number | null {
  if (!oldPrice) return null;
  const now = Number(price.value);
  const before = Number(oldPrice.value);
  if (!(before > now) || now <= 0) return null;
  const percent = Math.round((1 - now / before) * 100);
  return percent > 0 ? percent : null;
}
