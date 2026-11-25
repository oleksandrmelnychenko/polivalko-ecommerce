import type { ProductDetails } from "@polivalko/shared/api/types";
import { absoluteUrl, organizationId, SITE_NAME } from "@/features/seo";
import { hasPrice } from "@/shared/lib/price";
import { descriptionText } from "./description";
import { gtinFromAttributes } from "@polivalko/shared/lib/gtin";

export function productJsonLd(product: ProductDetails) {
  const url = absoluteUrl(`/product/${product.slug}`);
  // The product's own text first: the SEO description is usually the shop-wide template (name, price, delivery).
  const description = descriptionText(product.descriptionHtml) || product.seoDescription?.trim() || undefined;
  const gtin = gtinFromAttributes(product.attributes);
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: product.name,
    sku: product.sku,
    ...(gtin ? { [gtin.property]: gtin.value } : {}),
    description,
    image: product.images.length > 0 ? product.images.map((image) => absoluteUrl(image.url)) : undefined,
    category: product.category.name,
    brand: product.brand ? { "@type": "Brand", name: product.brand } : undefined,
    additionalProperty:
      product.attributes.length > 0
        ? product.attributes.map((attribute) => ({ "@type": "PropertyValue", name: attribute.name, value: attribute.value }))
        : undefined,
    // Пропозиції з ціною 0 не буває: товар без ціни не продається, тож Offer не публікуємо.
    offers: hasPrice(product.price)
      ? {
          "@type": "Offer",
          "@id": `${url}#offer`,
          url,
          price: product.price.value,
          priceCurrency: product.price.currency,
          availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", "@id": organizationId(), name: SITE_NAME, url: absoluteUrl("/") },
        }
      : undefined,
  };
}
