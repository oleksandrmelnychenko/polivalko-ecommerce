"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cleanPageLocation, isAnalyticsAllowedLocation, isPrivateAnalyticsPath } from "../lib/privacy";

const SCRIPT_ID = "pv-ga4-script";
// Production GA4 property for poli-valko.com; local/preview hosts are blocked by isAnalyticsAllowedLocation().
const DEFAULT_MEASUREMENT_ID = "G-0XD2ETJM9X";
const CONFIGURED_ID = (process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? DEFAULT_MEASUREMENT_ID).trim();

function ensureGtag(measurementId: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (!isAnalyticsAllowedLocation(window.location)) return false;

  if (!window.dataLayer) window.dataLayer = [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args);
    };
    window.gtag("js", new Date());
    // Disable automatic page_view so every URL sent to GA4 passes through cleanPageLocation().
    window.gtag("config", measurementId, {
      send_page_view: false,
      anonymize_ip: true,
    });
  }

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
    document.head.appendChild(script);
  }
  return true;
}

export function GoogleAnalytics({ measurementId = CONFIGURED_ID }: { measurementId?: string } = {}) {
  const pathname = usePathname();
  const id = measurementId.trim();
  const allowed = Boolean(id) && !isPrivateAnalyticsPath(pathname);

  useEffect(() => {
    if (!allowed || !ensureGtag(id)) return;
    window.gtag?.("event", "page_view", {
      page_path: pathname,
      page_location: cleanPageLocation(window.location),
      page_title: document.title,
    });
  }, [allowed, id, pathname]);

  return null;
}
