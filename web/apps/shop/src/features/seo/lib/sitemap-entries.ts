type ChangeDate = string | null | undefined;

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
 */
export function staticSitemapEntries(site: string, paths: readonly string[], changedAt: Readonly<Record<string, ChangeDate>>) {
  return paths.map((path) => {
    const lastModified = changedAt[path];
    return {
      url: `${site}${path}`,
      ...(lastModified ? { lastModified } : {}),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.5,
    };
  });
}
