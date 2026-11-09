const AUTH_PAGES = /^\/account\/(login|register)(\/|\?|$)/;

export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  if (!next || !/^\/(?![/\\])/.test(next) || /[\u0000-\u0020\u007f\\]/.test(next)) return fallback;
  try {
    const origin = "https://polivalko.invalid";
    const url = new URL(next, origin);
    if (url.origin !== origin || url.pathname.startsWith("//") || AUTH_PAGES.test(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function loginHref(next: string, reason?: "favorites"): string {
  const query = new URLSearchParams({ next });
  if (reason) query.set("reason", reason);
  return `/account/login?${query}`;
}

export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}
