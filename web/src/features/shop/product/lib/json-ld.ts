import type { ProductDetails } from "@/shared/api/types";

export function productJsonLd(product: ProductDetails) {
  const url = new URL(`/product/${product.slug}`, process.env.SITE_URL ?? "http://localhost:3000").toString();
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: product.images.map((i) => i.url),
    ...(product.brand ? { brand: { "@type": "Brand", name: product.brand } } : {}),
    offers: {
      "@type": "Offer",
      price: product.price.value,
      priceCurrency: product.price.currency,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      url,
    },
  };
}
