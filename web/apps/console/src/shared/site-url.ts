export function siteUrl(path: string): string {
  return `${process.env.SITE_URL}${path}`;
}
