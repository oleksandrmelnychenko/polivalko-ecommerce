"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { CONFIGURED_GA_MEASUREMENT_ID, DEFAULT_GA_MEASUREMENT_ID, ensureGtag } from "../lib/gtag";
import { cleanPageLocation, isPrivateAnalyticsPath } from "../lib/privacy";

export function GoogleAnalytics({ measurementId = CONFIGURED_GA_MEASUREMENT_ID }: { measurementId?: string } = {}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.trim() ?? "";
  const id = measurementId.trim() || DEFAULT_GA_MEASUREMENT_ID;
  const allowed = Boolean(id) && !isPrivateAnalyticsPath(pathname);

  useEffect(() => {
    if (!allowed || !ensureGtag(id)) return;
    const pagePath = searchQuery ? `${pathname}?q=${encodeURIComponent(searchQuery)}` : pathname;
    window.gtag?.("event", "page_view", {
      page_path: pagePath,
      page_location: cleanPageLocation(window.location),
      page_title: document.title,
    });
  }, [allowed, id, pathname, searchQuery]);

  return null;
}
