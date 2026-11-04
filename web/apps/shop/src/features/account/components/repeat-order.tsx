"use client";

import { useState } from "react";
import { useCart } from "@/features/cart";
import type { Order } from "@polivalko/shared/api/types";
import { postQuote } from "../api/client";
import { offline, type Status } from "../lib/form-status";
import { repeatStatus } from "../lib/repeat-result";
import { FormStatus } from "./form-status";

export function RepeatOrder({ order }: { order: Order }) {
  const { add } = useCart();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  async function repeat() {
    setBusy(true);
    setStatus(null);
    try {
      const { data } = await postQuote(order.items.map((i) => ({ productId: i.productId, quantity: i.quantity })));
      if (!data) throw new Error("quote");
      const missing: string[] = [];
      const reduced: string[] = [];
      let added = 0;
      for (const line of data.items) {
        const name = order.items.find((i) => i.productId === line.productId)?.name ?? line.name;
        if (line.issue === "unavailable" || line.availableQuantity <= 0) {
          missing.push(name);
          continue;
        }
        const quantity = Math.min(line.quantity, line.availableQuantity);
        if (quantity < line.quantity) reduced.push(name);
        add({ productId: line.productId, name: line.name, slug: line.slug, sku: line.sku, price: line.unitPrice.value, imageUrl: line.imageUrl }, quantity);
        added += 1;
      }
      setStatus(repeatStatus(added, data.items.length, missing, reduced));
    } catch {
      setStatus(offline);
    }
    setBusy(false);
  }

  return (
    <div className="repeat-order">
      <button type="button" className="btn btn--quiet" onClick={repeat} disabled={busy} aria-busy={busy}>
        {busy ? "Додаємо…" : "Повторити замовлення"}
      </button>
      <FormStatus status={status} />
    </div>
  );
}
