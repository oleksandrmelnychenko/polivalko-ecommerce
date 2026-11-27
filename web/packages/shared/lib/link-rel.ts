/** The shop's own hosts: a link to any of them is internal, whatever its scheme. */
export const SHOP_HOSTS = ["poli-valko.com", "www.poli-valko.com"] as const;

/** `rel` for links that leave the shop: no `nofollow`, so editorial links to manufacturers still pass trust. */
export const EXTERNAL_LINK_REL = "noopener noreferrer";

const NON_HTTP_SCHEME = /^(mailto|tel|sms):/i;
const ANY_SCHEME = /^[a-z][a-z\d+.-]*:/i;

function hostOf(value: string): string | null {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Whether a link stays on the shop: a relative path (`/catalog/...`, `#faq`, `?page=2`, `services/x`), a link to the
 * shop's own host, or a mail/phone link. Such links must never carry `nofollow` or open a new tab.
 */
export function isInternalHref(href: string | null | undefined, extraHosts: readonly string[] = []): boolean {
  const value = href?.trim() ?? "";
  if (!value) return true;
  if (NON_HTTP_SCHEME.test(value)) return true;
  const absolute = value.startsWith("//") ? `https:${value}` : value;
  if (!ANY_SCHEME.test(absolute)) return true;
  const host = hostOf(absolute);
  if (!host) return false;
  const own = [...SHOP_HOSTS, ...extraHosts.map((h) => h.trim().toLowerCase()).filter(Boolean)];
  return own.includes(host);
}

/** `rel` and `target` for a link in shop content: none for internal links, a safe new tab for external ones. */
export function linkRelAttributes(
  href: string | null | undefined,
  extraHosts: readonly string[] = [],
): { rel: string | null; target: string | null } {
  return isInternalHref(href, extraHosts) ? { rel: null, target: null } : { rel: EXTERNAL_LINK_REL, target: "_blank" };
}
