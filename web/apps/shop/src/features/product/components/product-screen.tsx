import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { getCategory } from "@/features/catalog/server";
import { Suspense } from "react";
import type { ProductDetails } from "@polivalko/shared/api/types";
import type { DeliveryFacts } from "@/shared/lib/delivery-facts";
import { TrackViewItem } from "@/features/analytics";
import { discountPercent, ProductLabels, withoutSaleLabel } from "@/features/catalog";
import { Gallery } from "./gallery";
import { ProductAsk, ProductAskPending } from "./product-ask";
import { ProductBuybox } from "./product-buybox";
import { ProductDescription, ProductSpecs } from "./product-description";
import { ProductDeliveryFacts } from "./product-delivery-facts";
import { ProductJsonLd } from "./product-json-ld";
import { RelatedProducts } from "./related-products";

async function DeliverySection({ deliveryFacts }: { deliveryFacts: () => Promise<DeliveryFacts | null> }) {
  const facts = await deliveryFacts();
  if (!facts) return null;
  return (
    <section className="product-sheet__section" id="product-delivery">
      <h2>Доставка й оплата</h2>
      <ProductDeliveryFacts facts={facts} />
    </section>
  );
}

/** The page resolves the product first (see requireProduct), so a missing one is a real 404. */
export async function ProductScreen({ product, deliveryFacts, askPhone }: {
  product: ProductDetails;
  deliveryFacts: () => Promise<DeliveryFacts | null>;
  askPhone: () => Promise<string | null>;
}) {
  const category = await getCategory(product.category.slug).catch(() => null);
  const parents = [
    { name: "Каталог", path: "/catalog" },
    ...(category?.breadcrumbs ?? []).map(c => ({ name: c.name, path: `/catalog/${c.slug}` })),
    { name: product.category.name, path: `/catalog/${product.category.slug}` },
  ];
  const discount = discountPercent(product.price, product.oldPrice);
  const overview = (
    <div className="product" data-sku={product.sku}>
      <Gallery key={product.id} images={product.images} name={product.name}
        labels={<ProductLabels labels={withoutSaleLabel(product.labels, discount !== null)} className="gallery__labels" />}
      />
      <div className="product__summary">
        <ProductBuybox product={product} discount={discount} />
        <Suspense fallback={<ProductAskPending product={product} />}>
          <ProductAsk product={product} phone={askPhone} />
        </Suspense>
        <div className="product-sheet leaf-separated">
          {product.descriptionHtml && (
            <section className="product-sheet__section" id="product-description">
              <h2>Опис товару</h2>
              <ProductDescription product={product} />
            </section>
          )}
          <section className="product-sheet__section" id="product-specs">
            <h2>Характеристики</h2>
            <ProductSpecs product={product} />
          </section>
          <Suspense fallback={null}>
            <DeliverySection deliveryFacts={deliveryFacts} />
          </Suspense>
        </div>
      </div>
    </div>
  );
  return (
    <div className="container product-page">
      <ProductJsonLd product={product} parents={parents} />
      <TrackViewItem item={{ item_id: product.sku, item_name: product.name, price: Number(product.price.value), quantity: 1 }} />
      <Breadcrumbs current={product.name} parents={parents} />

      {overview}
      <Suspense fallback={null}>
        <RelatedProducts category={product.category.slug} exclude={product.id} name={product.name} />
      </Suspense>
    </div>
  );
}
