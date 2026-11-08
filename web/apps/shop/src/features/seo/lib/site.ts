export const SITE_NAME = "Poli Valko";
export const SITE_LOCALE = "uk_UA";
export const SITE_LANGUAGE = "uk-UA";

export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

export function absoluteUrl(path = "/"): string {
  return new URL(path, `${siteUrl()}/`).toString();
}

export function organizationId(): string {
  return `${siteUrl()}/#organization`;
}

export function websiteId(): string {
  return `${siteUrl()}/#website`;
}
