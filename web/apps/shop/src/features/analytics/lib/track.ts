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
