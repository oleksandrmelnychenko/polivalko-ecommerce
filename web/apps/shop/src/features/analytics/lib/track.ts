export type AnalyticsItem = { item_id: string; item_name: string; price: number; quantity: number };

export function track(_event: "view_item" | "add_to_cart" | "begin_checkout" | "purchase", _params: Record<string, unknown>) {
  // Intentionally no collection or queue while token-bearing URLs are in use.
  void _event;
  void _params;
}

export function itemsValue(items: AnalyticsItem[]) {
  return Math.round(items.reduce((sum, i) => sum + i.price * i.quantity, 0) * 100) / 100;
}
