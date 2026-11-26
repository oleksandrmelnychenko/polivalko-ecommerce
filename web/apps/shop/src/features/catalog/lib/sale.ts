/**
 * An empty sale page is not worth a search result or a sitemap entry.
 * `null` means the catalog did not answer: indexing stays as it was rather than flipping on a failed request.
 */
export function saleIsEmpty(saleProducts: number | null): boolean {
  return saleProducts === 0;
}
