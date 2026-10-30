"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { browserApi, type Quote } from "./api/browser";
import { useCart } from "./cart";

/**
 * Кошик, перерахований сервером (POST /api/v1/checkout/quote): ціни, наявність, способи отримання й оплати.
 * Перераховується через 200 мс після зміни складу кошика; `refresh` — після відповіді «ціни змінилися».
 */
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
    const { data } = await browserApi.POST("/api/v1/checkout/quote", { body: { items } });
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
