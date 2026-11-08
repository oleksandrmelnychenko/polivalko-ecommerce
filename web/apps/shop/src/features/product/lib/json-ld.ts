import type { ProductDetails } from "@polivalko/shared/api/types";
import { absoluteUrl, organizationId, SITE_NAME } from "@/features/seo";
import { descriptionText } from "./description";

export function productJsonLd(product: ProductDetails) {
  const url = absoluteUrl(`/product/${product.slug}`);
  const description = product.seoDescription?.trim() || descriptionText(product.descriptionHtml) || undefined;
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: product.name,
    sku: product.sku,
    description,
    image: product.images.length > 0 ? product.images.map((image) => absoluteUrl(image.url)) : undefined,
    category: product.category.name,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    additionalProperty:
      product.attributes.length > 0
        ? product.attributes.map((attribute) => ({ "@type": "PropertyValue", name: attribute.name, value: attribute.value }))
        : undefined,
    offers: {
      "@type": "Offer",
      "@id": `${url}#offer`,
      url,
      price: product.price.value,
      priceCurrency: product.price.currency,
      availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", "@id": organizationId(), name: SITE_NAME, url: absoluteUrl("/") },
    },
  };
}
