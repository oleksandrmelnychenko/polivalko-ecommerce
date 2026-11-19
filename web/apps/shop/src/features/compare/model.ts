import type { ProductDetails } from "@polivalko/shared/api/types";

export type CompareProduct = {
  id: string; slug: string; name: string; sku: string;
  imageUrl?: string | null; brand?: string | null;
  price: { value: string; currency: string }; oldPrice?: { value: string; currency: string } | null;
  inStock: boolean;
  category?: { slug: string; name: string };
  attributes?: { name: string; value: string }[];
};

const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase("uk");
export function comparisonGroup(product: CompareProduct) {
  if (!product.category) return { key: `pending:${product.id}`, name: "Уточнюємо категорію", slug: "" };
  const type = product.attributes?.find(a => ["тип", "тип товару", "вид товару"].includes(normalize(a.name)))?.value.trim();
  return { key: `${product.category.slug}${type ? `:${normalize(type)}` : ""}`, name: type ? `${product.category.name} · ${type}` : product.category.name, slug: product.category.slug };
}

export function fromDetails(product: ProductDetails): CompareProduct {
  return { id: product.id, slug: product.slug, name: product.name, sku: product.sku, imageUrl: product.images[0]?.url, brand: product.brand, price: product.price, oldPrice: product.oldPrice, inStock: product.inStock, category: product.category, attributes: product.attributes };
}

export function comparisonRows(products: CompareProduct[]) {
  const attributes = new Map<string, string>();
  products.forEach(p => p.attributes?.forEach(a => attributes.set(normalize(a.name), a.name)));
  const rows = [
    { key: "price", name: "Ціна", values: products.map(p => String(Number(p.price.value))) },
    { key: "availability", name: "Наявність", values: products.map(p => p.inStock ? "В наявності" : "Немає в наявності") },
    { key: "brand", name: "Бренд", values: products.map(p => p.brand || "—") },
    ...[...attributes].map(([key, name]) => ({ key: `attr:${key}`, name, values: products.map(p => p.attributes?.find(a => normalize(a.name) === key)?.value || "—") })),
  ];
  return rows.map(row => ({ ...row, differs: products.length > 1 && new Set(row.values.map(normalize)).size > 1 }));
}
