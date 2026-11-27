const PRIVATE_PREFIXES = ["/order", "/account", "/pay"] as const;

const SECRET_QUERY_KEYS = new Set([
  "token",
  "code",
  "access_token",
  "accesstoken",
  "password",
  "secret",
]);

const ALLOWED_ANALYTICS_QUERY_KEYS = new Set([
  "q",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "fbclid",
  "msclkid",
]);

export type LocationLike = {
  origin?: string;
  hostname?: string;
  pathname?: string;
  search?: string;
  href?: string;
};

function parsedLocation(loc: LocationLike | undefined): {
  origin: string;
  hostname: string;
  pathname: string;
  search: string;
} {
  if (!loc) return { origin: "", hostname: "", pathname: "/", search: "" };
  if ((!loc.pathname || !loc.hostname) && loc.href) {
    try {
      const url = new URL(loc.href);
      return {
        origin: loc.origin ?? url.origin,
        hostname: loc.hostname ?? url.hostname,
        pathname: loc.pathname ?? url.pathname,
        search: loc.search ?? url.search,
      };
    } catch {
      return { origin: loc.origin ?? "", hostname: loc.hostname ?? "", pathname: loc.pathname ?? "/", search: loc.search ?? "" };
    }
  }
  return {
    origin: loc.origin ?? "",
    hostname: loc.hostname ?? "",
    pathname: loc.pathname ?? "/",
    search: loc.search ?? "",
  };
}

/** True for routes that may hold bearer tokens or private account/payment state. */
export function isPrivateAnalyticsPath(pathname: string | null | undefined): boolean {
  if (!pathname) return true;
  const normalized = pathname.trim().toLowerCase();
  return PRIVATE_PREFIXES.some((prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`));
}

/** True when any URL query parameter name resembles a credential or recovery token. */
export function hasSecretQuery(search: string | null | undefined): boolean {
  if (!search) return false;
  try {
    const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    for (const key of params.keys()) {
      if (SECRET_QUERY_KEYS.has(key.trim().toLowerCase())) return true;
    }
    return false;
  } catch {
    return true;
  }
}

/** Skip analytics collection on local/dev/test/preview hosts so production GA4 stays clean. */
export function isLocalHostname(hostname: string | null | undefined): boolean {
  if (!hostname) return true;
  const host = hostname.trim().toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".test") ||
    host.endsWith(".vercel.app")
  );
}

/** Strict allowlist gate before loading gtag.js or dispatching any GA4 event. */
export function isAnalyticsAllowedLocation(loc: LocationLike | undefined): boolean {
  const { hostname, pathname, search } = parsedLocation(loc);
  if (isLocalHostname(hostname)) return false;
  if (isPrivateAnalyticsPath(pathname)) return false;
  if (hasSecretQuery(search)) return false;
  return true;
}

/** Returns origin + pathname plus allowlisted marketing/site-search query params (all other params & hashes stripped). */
export function cleanPageLocation(loc: LocationLike | undefined): string {
  const { origin, pathname, search } = parsedLocation(loc);
  if (!search) return `${origin}${pathname}`;
  try {
    const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
    const safe = new URLSearchParams();
    for (const [key, value] of raw.entries()) {
      const normalized = key.trim().toLowerCase();
      if (ALLOWED_ANALYTICS_QUERY_KEYS.has(normalized) && value.length <= 200) {
        safe.append(normalized, value);
      }
    }
    const qs = safe.toString();
    return qs ? `${origin}${pathname}?${qs}` : `${origin}${pathname}`;
  } catch {
    return `${origin}${pathname}`;
  }
}
