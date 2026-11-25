const BARCODE_ATTRIBUTES = new Set(["штрихкод", "штрих-код", "ean", "gtin"]);

export type GtinProperty = "gtin8" | "gtin12" | "gtin13" | "gtin14";

/**
 * The product's barcode as a schema.org GTIN, or null when it is not a real one.
 * The catalog keeps the barcode as an ordinary attribute, and for some products it holds the shop's own article
 * number (e.g. "11971"); only a value with a valid check digit is a GTIN. EAN-13 codes starting with 2 (and 02/04
 * in GTIN-13 form) are for internal, in-store use and are not global trade item numbers.
 */
export function gtinFromAttributes(attributes: readonly { name: string; value: string }[]): { property: GtinProperty; value: string } | null {
  for (const attribute of attributes) {
    if (!isBarcodeAttribute(attribute.name)) continue;
    const value = attribute.value.trim();
    if (isGlobalGtin(value)) return { property: `gtin${value.length}` as GtinProperty, value };
  }
  return null;
}

/** Whether the shop reads this attribute as the barcode (case and spacing ignored). */
export function isBarcodeAttribute(name: string): boolean {
  return BARCODE_ATTRIBUTES.has(name.trim().toLowerCase());
}

export function isGlobalGtin(value: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
  if (value.length === 13 && (value.startsWith("2") || value.startsWith("02") || value.startsWith("04"))) return false;
  if (/^0+$/.test(value)) return false;
  return hasValidCheckDigit(value);
}

function hasValidCheckDigit(value: string): boolean {
  const digits = [...value].map(Number);
  const check = digits.pop()!;
  // From the right, excluding the check digit: weights 3, 1, 3, 1…
  const sum = digits.reverse().reduce((total, digit, i) => total + digit * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}
