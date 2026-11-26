/**
 * The word that names the kind of product: the first word of its name made of letters only («Томат», «Контролер»),
 * past any leading article number. Null when the name has no such word.
 */
export function typeWord(name: string): string | null {
  const words = name.split(/\s+/).map((part) => part.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, ""));
  return words.find((word) => /^\p{L}{3,}$/u.test(word)) ?? null;
}

/**
 * Up to `count` related products: those of the same kind first, then the rest of the category, without the product
 * itself or repeats.
 */
export function relatedItems<T extends { id: string }>(sameKind: readonly T[], sameCategory: readonly T[], exclude: string, count = 5): T[] {
  const seen = new Set([exclude]);
  const items: T[] = [];
  for (const item of [...sameKind, ...sameCategory]) {
    if (items.length === count) break;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}
