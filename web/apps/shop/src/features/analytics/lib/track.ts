import { ensureGtag } from "./gtag";
import { cleanPageLocation, isAnalyticsAllowedLocation } from "./privacy";

export type AnalyticsItem = { item_id: string; item_name: string; price: number; quantity: number };

export type AnalyticsEvent = "view_item" | "add_to_cart" | "begin_checkout" | "purchase" | "generate_lead";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: AnalyticsEvent, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  if (!isAnalyticsAllowedLocation(window.location)) return;
  // Child effects (e.g. TrackViewItem on direct product visits) run before RootLayout's GoogleAnalytics effect.
  if (typeof window.gtag !== "function" && !ensureGtag()) return;
  window.gtag?.("event", event, {
    ...params,
    page_location: cleanPageLocation(window.location),
  });
}

export function itemsValue(items: AnalyticsItem[]) {
  return Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
}
