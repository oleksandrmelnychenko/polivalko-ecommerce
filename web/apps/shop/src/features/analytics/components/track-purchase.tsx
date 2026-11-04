"use client";

import { useEffect } from "react";
import { itemsValue, track, type AnalyticsItem } from "../lib/track";

export function TrackPurchase({ orderNumber, items }: { orderNumber: string; items: AnalyticsItem[] }) {
  useEffect(() => {
    const key = `pv-purchase-${orderNumber}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {}
    track("purchase", { transaction_id: orderNumber, currency: "UAH", value: itemsValue(items), items });
  }, [orderNumber, items]);
  return null;
}
