import { isAnalyticsAllowedLocation } from "./privacy";

const SCRIPT_ID = "pv-ga4-script";
// Production GA4 property for poli-valko.com; local/preview hosts are blocked by isAnalyticsAllowedLocation().
export const DEFAULT_GA_MEASUREMENT_ID = "G-0XD2ETJM9X";
export const CONFIGURED_GA_MEASUREMENT_ID =
  (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() : "") ||
  DEFAULT_GA_MEASUREMENT_ID;

export function installGtagStub() {
  if (typeof window === "undefined") return;
  if (!window.dataLayer) window.dataLayer = [];
  if (typeof window.gtag !== "function") {
    // Google's gtag.js requires real Arguments objects in dataLayer and silently ignores plain arrays (...args).
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments);
    };
  }
}

export function ensureGtag(measurementId = CONFIGURED_GA_MEASUREMENT_ID) {
  if (typeof window === "undefined" || typeof document === "undefined") return false;
  if (!isAnalyticsAllowedLocation(window.location)) return false;

  const id = measurementId.trim() || DEFAULT_GA_MEASUREMENT_ID;
  const isFresh = typeof window.gtag !== "function";
  installGtagStub();
  if (isFresh) {
    window.gtag?.("js", new Date());
    // Disable automatic page_view so every URL sent to GA4 passes through cleanPageLocation().
    window.gtag?.("config", id, {
      send_page_view: false,
      anonymize_ip: true,
    });
  }

  if (!document.getElementById(SCRIPT_ID)) {
    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  }
  return true;
}
