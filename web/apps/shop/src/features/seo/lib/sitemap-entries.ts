type ChangeDate = string | null | undefined;

export type SitemapUrlEntry = {
  url: string;
  lastModified?: string;
  changeFrequency?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: number;
};

export type SitemapIndexEntry = {
  url: string;
  lastModified?: string;
};

export const SITEMAP_XML_HEADERS: Readonly<Record<string, string>> = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
};

/** The latest of the given change dates, compared as moments in time; undefined when none is known. */
export function latestChange(dates: readonly ChangeDate[]): string | undefined {
  let latest: string | undefined;
  for (const date of dates) {
    if (date && (latest === undefined || Date.parse(date) > Date.parse(latest))) latest = date;
  }
  return latest;
}

/**
 * Sitemap entries for the shop's own pages. `lastModified` is set only from a real change date: search engines use
 * the field while it proves accurate, so a page without a known date goes without one rather than with a guess.
 * Homepage (`""` or `"/"`) always uses a trailing slash to match canonical and `og:url`.
 */
export function staticSitemapEntries(
  site: string,
  paths: readonly string[],
  changedAt: Readonly<Record<string, ChangeDate>>,
): SitemapUrlEntry[] {
  const base = site.replace(/\/+$/, "");
  return paths.map((path) => {
    const isHome = path === "" || path === "/";
    const lastModified = changedAt[path] ?? (isHome ? changedAt["/"] ?? changedAt[""] : undefined);
    return {
      url: isHome ? `${base}/` : `${base}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: isHome ? 1 : 0.5,
    };
  });
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function sitemapXml(entries: readonly SitemapUrlEntry[]): string {
  const body = entries
    .map((entry) => {
      const parts = [`<loc>${escapeXml(entry.url)}</loc>`];
      if (entry.lastModified) parts.push(`<lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
      if (entry.changeFrequency) parts.push(`<changefreq>${entry.changeFrequency}</changefreq>`);
      if (entry.priority !== undefined) parts.push(`<priority>${entry.priority}</priority>`);
      return `  <url>${parts.join("")}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function sitemapIndexXml(entries: readonly SitemapIndexEntry[]): string {
  const body = entries
    .map((entry) => {
      const parts = [`<loc>${escapeXml(entry.url)}</loc>`];
      if (entry.lastModified) parts.push(`<lastmod>${escapeXml(entry.lastModified)}</lastmod>`);
      return `  <sitemap>${parts.join("")}</sitemap>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}
