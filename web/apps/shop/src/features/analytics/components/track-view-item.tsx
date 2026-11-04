"use client";

import { useEffect } from "react";
import { track, type AnalyticsItem } from "../lib/track";

export function TrackViewItem({ item }: { item: AnalyticsItem }) {
  useEffect(() => {
    track("view_item", { currency: "UAH", value: item.price, items: [item] });
  }, [item]);
  return null;
}
