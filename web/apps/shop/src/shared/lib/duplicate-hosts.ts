/** Other addresses under which the hosting platform serves the whole shop; search engines should see one site. */
const DUPLICATE_HOSTS = ["polivalko.vercel.app"];

/**
 * Permanent redirects from those hosts to the shop's own address (SITE_URL), keeping the path and the query.
 * Matched by the exact Host of the request, so the shop's own domain is never redirected; without SITE_URL
 * (local development, tests) there is nowhere to send the visitor and no rule is made.
 */
export function duplicateHostRedirects(siteUrl: string | undefined) {
  const site = siteUrl?.trim().replace(/\/+$/, "");
  if (!site) return [];
  const ownHost = new URL(site).host;
  return DUPLICATE_HOSTS.filter((host) => host !== ownHost).map((host) => ({
    source: "/:path*",
    has: [{ type: "host" as const, value: host.replaceAll(".", "\\.") }],
    destination: `${site}/:path*`,
    permanent: true,
  }));
}
