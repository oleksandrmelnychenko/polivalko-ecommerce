const AUTH_PAGES = /^\/account\/(login|register)(\/|\?|$)/;

export function safeNext(next: string | null | undefined, fallback = "/account"): string {
  return next && /^\/(?![/\\])/.test(next) && !AUTH_PAGES.test(next) ? next : fallback;
}

export function loginHref(next: string, reason?: "favorites"): string {
  const query = new URLSearchParams({ next });
  if (reason) query.set("reason", reason);
  return `/account/login?${query}`;
}

export function currentPath(): string {
  return `${window.location.pathname}${window.location.search}`;
}
