"use client";

import Script from "next/script";
import { useEffect } from "react";

/**
 * Події GA4 (розділ 10 ТЗ): перегляд товару, додавання в кошик, початок оформлення, покупка.
 * Передаються лише товари й суми, без імені, телефону чи email покупця.
 * Без NEXT_PUBLIC_GA_MEASUREMENT_ID події лише складаються в dataLayer (зручно для перевірки).
 */
export type AnalyticsItem = { item_id: string; item_name: string; price: number; quantity: number };

type Gtag = (command: "event" | "config" | "js", target: string | Date, params?: Record<string, unknown>) => void;
type AnalyticsWindow = Window & { dataLayer?: unknown[]; gtag?: Gtag };

export const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";

export function track(event: "view_item" | "add_to_cart" | "begin_checkout" | "purchase", params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const w = window as AnalyticsWindow;
  if (w.gtag) w.gtag("event", event, params);
  else (w.dataLayer ??= []).push({ event, ...params });
}

export function itemsValue(items: AnalyticsItem[]) {
  return Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
}

/** Покупка рахується один раз на номер замовлення, навіть якщо сторінку результату відкрили кілька разів. */
export function TrackPurchase({ orderNumber, items }: { orderNumber: string; items: AnalyticsItem[] }) {
  useEffect(() => {
    const key = `pv-purchase-${orderNumber}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // Без сховища дублікат відсіє GA4 за transaction_id.
    }
    track("purchase", { transaction_id: orderNumber, currency: "UAH", value: itemsValue(items), items });
  }, [orderNumber, items]);
  return null;
}

export function TrackViewItem({ item }: { item: AnalyticsItem }) {
  useEffect(() => {
    track("view_item", { currency: "UAH", value: item.price, items: [item] });
  }, [item]);
  return null;
}

/** Підключає gtag.js лише тоді, коли задано ідентифікатор потоку GA4. */
export function GoogleAnalytics() {
  if (!GA_ID) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
