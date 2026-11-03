import type { Quote } from "@/shared/api/types";
import { formatMoney, formatPrice } from "@/shared/lib/format";
import type { CartLine } from "./cart-store";

export function cartRows(quote: Quote | null, lines: CartLine[]) {
  return quote
    ? quote.items.map((i) => ({ ...i, unit: formatMoney(i.unitPrice), total: formatMoney(i.lineTotal) }))
    : lines.map((l) => ({
        ...l,
        issue: null,
        availableQuantity: null,
        unit: formatPrice(l.price),
        total: formatPrice(Number(l.price) * l.quantity),
      }));
}

export type CartRow = ReturnType<typeof cartRows>[number];
