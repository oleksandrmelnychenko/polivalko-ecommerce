"use client";

export type ShopActivityKind = "favorite_add" | "favorite_remove" | "compare_add" | "compare_remove";

const ENDPOINT = "/api/v1/cart/activity";

/**
 * Best-effort storefront activity signal for the Console real-time Sales feed.
 * Never throws or blocks user actions; cart changes are recorded directly on the server.
 */
export function reportShopActivity(kind: ShopActivityKind, productId: string) {
  if (typeof window === "undefined" || typeof document === "undefined" || typeof fetch !== "function") return;
  if (!window.location?.protocol?.startsWith("http")) return;
  if (!productId) return;
  void fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, productId }),
    credentials: "same-origin",
    keepalive: true,
  }).catch(() => {});
}
