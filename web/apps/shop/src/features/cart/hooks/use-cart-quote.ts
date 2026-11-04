"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { quoteCart } from "../api/client";
import { useCart } from "../components/cart-provider";

export function useCartQuote() {
  const { lines } = useCart();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [failed, setFailed] = useState(false);

  const items = useMemo(() => lines.map((l) => ({ productId: l.productId, quantity: l.quantity })), [lines]);

  const refresh = useCallback(async () => {
    if (items.length === 0) {
      setQuote(null);
      return null;
    }
    const { data } = await quoteCart(items);
    setFailed(!data);
    setQuote(data ?? null);
    return data ?? null;
  }, [items]);

  useEffect(() => {
    const t = setTimeout(() => void refresh(), 200);
    return () => clearTimeout(t);
  }, [refresh]);

  return { items, quote, failed, refresh };
}
