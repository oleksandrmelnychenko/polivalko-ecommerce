import type { Money } from "./api/server";

const amount = (fractions: number) =>
  new Intl.NumberFormat("uk-UA", { minimumFractionDigits: fractions, maximumFractionDigits: 2 });

/**
 * Ціна для показу: без копійок, коли їх немає. Знак ₴ додаємо самі: ICU у Node й у браузері
 * пишуть валюту по-різному («₴» і «грн»), а сервер і клієнт мають показувати однаково.
 */
export function formatPrice(value: string | number): string {
  const n = Number(value);
  return `${amount(Number.isInteger(n) ? 0 : 2).format(n)} ₴`;
}

export function formatMoney(money: Money): string {
  return formatPrice(money.value);
}

/** Українська множина: 1 товар, 2 товари, 5 товарів. */
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

/** Перше значення query-параметра (Next.js віддає string | string[] | undefined). */
export function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Текст без HTML. Повний HTML опису з'явиться разом із санітизацією в модулі адмінки. */
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
