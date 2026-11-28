import type { ProductDetails } from "@polivalko/shared/api/types";
import {
  absoluteUrl,
  computeOfferValidFrom,
  computePriceValidUntil,
  merchantReturnPolicy,
  organizationId,
  productShippingDetails,
  SITE_NAME,
} from "@/features/seo";
import { hasPrice } from "@/shared/lib/price";
import { googleProductCategory } from "@/shared/lib/google-product-taxonomy";
import { extractProductModel, resolveProductBrand } from "@/shared/lib/product-brand";
import { markupDescription } from "./description";
import { gtinFromAttributes } from "@polivalko/shared/lib/gtin";

export { googleProductCategory };

export type ProductRatingInput = {
  ratingValue: number;
  reviewCount: number;
  bestRating?: number;
  worstRating?: number;
};

export type ProductReviewInput = {
  authorName: string;
  ratingValue: number;
  reviewBody?: string;
  datePublished?: string;
};

export type ProductJsonLdOptions = {
  validFrom?: string;
  priceValidUntil?: string;
  referenceDate?: Date | string;
  aggregateRating?: ProductRatingInput | null;
  reviews?: ReadonlyArray<ProductReviewInput> | null;
};

function buildAggregateRating(rating?: ProductRatingInput | null) {
  if (!rating) return undefined;
  const bestRating = rating.bestRating ?? 5;
  const worstRating = rating.worstRating ?? 1;
  if (
    !Number.isInteger(rating.reviewCount) ||
    rating.reviewCount < 1 ||
    !Number.isFinite(rating.ratingValue) ||
    rating.ratingValue < worstRating ||
    rating.ratingValue > bestRating
  ) {
    return undefined;
  }
  return {
    "@type": "AggregateRating",
    ratingValue: Number(rating.ratingValue.toFixed(2)),
    reviewCount: rating.reviewCount,
    bestRating,
    worstRating,
  };
}

function buildReviews(reviews?: ReadonlyArray<ProductReviewInput> | null) {
  if (!reviews || reviews.length === 0) return undefined;
  const valid = reviews
    .filter(
      (review) =>
        review.authorName.trim().length > 0 &&
        Number.isFinite(review.ratingValue) &&
        review.ratingValue >= 1 &&
        review.ratingValue <= 5,
    )
    .map((review) => ({
      "@type": "Review",
      author: { "@type": "Person", name: review.authorName.trim() },
      reviewRating: {
        "@type": "Rating",
        ratingValue: review.ratingValue,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: review.reviewBody?.trim() || undefined,
      datePublished: review.datePublished || undefined,
    }));
  return valid.length > 0 ? valid : undefined;
}

export function productJsonLd(product: ProductDetails, options?: ProductJsonLdOptions) {
  const url = absoluteUrl(`/product/${product.slug}`);
  const description = markupDescription(product);
  const gtin = gtinFromAttributes(product.attributes);
  const mpn = extractProductModel(product.attributes);
  const brand = resolveProductBrand(product);
  const aggregateRating = buildAggregateRating(options?.aggregateRating);
  const review = buildReviews(options?.reviews);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    url,
    name: product.name,
    sku: product.sku,
    ...(gtin ? { [gtin.property]: gtin.value } : {}),
    ...(mpn ? { mpn } : {}),
    description,
    image: product.images.length > 0 ? product.images.map((image) => absoluteUrl(image.url)) : undefined,
    category: googleProductCategory(product.category),
    brand: brand ? { "@type": "Brand", name: brand } : undefined,
    additionalProperty:
      product.attributes.length > 0
        ? product.attributes.map((attribute) => ({ "@type": "PropertyValue", name: attribute.name, value: attribute.value }))
        : undefined,
    aggregateRating,
    review,
    // Пропозиції з ціною 0 не буває: товар без ціни не продається, тож Offer не публікуємо.
    offers: hasPrice(product.price)
      ? {
          "@type": "Offer",
          "@id": `${url}#offer`,
          url,
          price: product.price.value,
          priceCurrency: product.price.currency,
          validFrom: options?.validFrom ?? computeOfferValidFrom(options?.referenceDate),
          priceValidUntil: options?.priceValidUntil ?? computePriceValidUntil(options?.referenceDate),
          availability: product.inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
          itemCondition: "https://schema.org/NewCondition",
          seller: { "@type": "Organization", "@id": organizationId(), name: SITE_NAME, url: absoluteUrl("/") },
          shippingDetails: productShippingDetails(product.price.currency),
          hasMerchantReturnPolicy: merchantReturnPolicy(),
        }
      : undefined,
  };
}
