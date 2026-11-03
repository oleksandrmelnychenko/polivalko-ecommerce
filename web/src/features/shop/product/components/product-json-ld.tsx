import type { ProductDetails } from "@/shared/api/types";
import { productJsonLd } from "../lib/json-ld";

export function ProductJsonLd({ product }: { product: ProductDetails }) {
  const data = productJsonLd(product);
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />;
}
