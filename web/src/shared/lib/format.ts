import type { Money } from "@/shared/api/types";

const amount = (fractions: number) =>
  new Intl.NumberFormat("uk-UA", { minimumFractionDigits: fractions, maximumFractionDigits: 2 });

export function formatPrice(value: string | number): string {
  const n = Number(value);
  return `${amount(Number.isInteger(n) ? 0 : 2).format(n)} ₴`;
}

export function formatMoney(money: Money): string {
  return formatPrice(money.value);
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function countProducts(n: number): string {
  return `${n.toLocaleString("uk-UA")} ${plural(n, "товар", "товари", "товарів")}`;
}

export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function plainText(html: string | null | undefined): string[] {
  if (!html) return [];
  return html
    .replace(/<\/(p|div|li|h\d)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Kyiv",
  }).format(new Date(iso));
}
