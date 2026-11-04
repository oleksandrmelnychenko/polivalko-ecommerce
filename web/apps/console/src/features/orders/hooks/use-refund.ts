"use client";

import { useRef, useState, type FormEvent } from "react";
import { withCsrf } from "@/shared/csrf";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import { createRefund } from "../api/client";
import type { ConsoleOrder } from "../lib/types";

export function useRefund(order: ConsoleOrder, onChange: (order: ConsoleOrder) => void) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  const refundable = new Map(order.refundable.map((r) => [r.productId, r.quantity]));
  const amount = order.items.reduce((sum, i) => sum + (quantities[i.productId] ?? 0) * Number(i.unitPrice.value), 0);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    key.current ??= newIdempotencyKey();
    const lines = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([productId, quantity]) => ({ productId, quantity }));
    const result = await withCsrf((headers) => createRefund(headers, order.number, key.current!, { lines, reason }));
    setBusy(false);
    if (result.data) {
      key.current = null;
      setQuantities({});
      setReason("");
      onChange(result.data);
    } else {
      const problem = result.error as Problem | undefined;
      setError(problem?.errors ? Object.values(problem.errors).flat().join(" ") : (problem?.title ?? "Повернення не оформлено."));
    }
  }

  return { quantities, setQuantities, reason, setReason, busy, error, refundable, amount, submit };
}
