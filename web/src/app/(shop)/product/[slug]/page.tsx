import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { Suspense } from "react";
import { BuyForm } from "@/components/add-to-cart";
import { Gallery } from "@/components/gallery";
import { ShieldIcon, StoreIcon, TruckIcon, WalletIcon } from "@/components/icons";
import { discountPercent, ProductTiles } from "@/components/product-card";
import { TrackViewItem } from "@/lib/analytics";
import type { ProductDetails } from "@/lib/api/server";
import { getProduct, resolveRedirect, searchProducts } from "@/lib/catalog";
import { formatMoney, plainText } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/product/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Товар не знайдено" };
  return {
    title: product.seoTitle ?? product.name,
    description: product.seoDescription ?? (plainText(product.descriptionHtml).join(" ").slice(0, 160) || undefined),
    alternates: { canonical: `/product/${product.slug}` },
  };
}

export default function ProductPage(props: PageProps<"/product/[slug]">) {
  return (
    <div className="container">
      <Suspense fallback={<div className="product"><div className="skeleton" style={{ aspectRatio: "1" }} /><div className="skeleton" style={{ height: "var(--space-4xl)" }} /></div>}>
        <ProductContent {...props} />
      </Suspense>
    </div>
  );
}

async function ProductContent({ params }: PageProps<"/product/[slug]">) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) {
    // Опублікований URL змінився: стара адреса веде на нову постійним перенаправленням (розділ 10 ТЗ).
    const target = await resolveRedirect(`/product/${slug}`);
    if (target) permanentRedirect(target);
    notFound();
  }

  const cartProduct = {
    productId: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    price: product.price.value,
    imageUrl: product.images[0]?.url ?? null,
  };
  const discount = discountPercent(product.price, product.oldPrice);

  return (
    <>
      <JsonLd product={product} />
      <TrackViewItem item={{ item_id: product.sku, item_name: product.name, price: Number(product.price.value), quantity: 1 }} />
      <nav className="crumbs product-crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/catalog">Каталог</Link>
          </li>
          <li>
            <Link href={`/catalog/${product.category.slug}`}>{product.category.name}</Link>
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      {/* Розділ 3 ТЗ: велике фото ліворуч; назва, ціна, наявність і покупка праворуч; на телефоні послідовно. */}
      <div className="product">
        <Gallery images={product.images} name={product.name} />

        <div className="buybox">
          <h1>{product.name}</h1>
          <p className="buybox__meta">
            <span>
              Артикул:{" "}
              <span className="code" translate="no">
                {product.sku}
              </span>
            </span>
            {product.brand && (
              <span>
                Бренд: <span translate="no">{product.brand}</span>
              </span>
            )}
          </p>
          <div className="buybox__card">
            <div>
              {discount && product.oldPrice && (
                <p className="buybox__was">
                  <s className="price-old">
                    <span className="visually-hidden">Стара ціна </span>
                    {formatMoney(product.oldPrice)}
                  </s>
                  <span className="flag flag--sale">−{discount}%</span>
                </p>
              )}
              <p className="buybox__price">
                <strong className={discount ? "price-sale" : undefined}>{formatMoney(product.price)}</strong>
              </p>
              <p className={product.inStock ? "stock stock--in" : "stock stock--out"}>{product.inStock ? "В наявності" : "Немає в наявності"}</p>
            </div>
            {product.variants.length > 1 && (
              <nav aria-label="Варіанти товару">
                <ul className="variants">
                  {product.variants.map((v) =>
                    v.isCurrent ? (
                      <li key={v.slug}>
                        <span aria-current="true">{v.label}</span>
                      </li>
                    ) : (
                      <li key={v.slug}>
                        <Link href={`/product/${v.slug}`} className={v.inStock ? undefined : "is-out"}>
                          {v.label}
                          {!v.inStock && <span className="visually-hidden"> (немає в наявності)</span>}
                        </Link>
                      </li>
                    ),
                  )}
                </ul>
              </nav>
            )}
            <BuyForm product={cartProduct} inStock={product.inStock} actionsClassName="buybox__actions" />
          </div>
          <ul className="facts-list buybox__note">
            <li>
              <TruckIcon />
              <span>Нова пошта по Україні: відділення, поштомат або кур&apos;єр, за тарифами перевізника</span>
            </li>
            <li>
              <StoreIcon />
              <span>Самовивіз з магазину в Бучі безкоштовно</span>
            </li>
            <li>
              <WalletIcon />
              <span>Оплата карткою онлайн, післяплатою або в магазині</span>
            </li>
            <li>
              <ShieldIcon />
              <span>
                Обмін і повернення — умови на сторінці{" "}
                <Link href="/returns" className="link">
                  «Повернення»
                </Link>
              </span>
            </li>
          </ul>
        </div>
      </div>

      <section className="description" aria-labelledby="about-title">
        <div>
          <h2 id="about-title">Опис</h2>
          {product.descriptionHtml ? (
            // Опис редагується в адмінці й зберігається API вже очищеним від небезпечної розмітки.
            <div className="prose" dangerouslySetInnerHTML={{ __html: product.descriptionHtml }} />
          ) : (
            <p className="muted">Опис додасть магазин.</p>
          )}
        </div>
        <div>
          <h2 id="specs-title">Характеристики</h2>
          <dl className="specs" aria-labelledby="specs-title">
            <div>
              <dt>Артикул</dt>
              <dd className="code" translate="no">
                {product.sku}
              </dd>
            </div>
            <div>
              <dt>Розділ</dt>
              <dd>
                <Link href={`/catalog/${product.category.slug}`} className="link">
                  {product.category.name}
                </Link>
              </dd>
            </div>
            {product.brand && (
              <div>
                <dt>Бренд</dt>
                <dd translate="no">{product.brand}</dd>
              </div>
            )}
            {product.attributes.map((a) => (
              <div key={a.name}>
                <dt>{a.name}</dt>
                <dd>{a.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <Suspense fallback={null}>
        <Related category={product.category.slug} exclude={product.id} />
      </Suspense>
    </>
  );
}

async function Related({ category, exclude }: { category: string; exclude: string }) {
  const result = await searchProducts({ category, pageSize: 5, sort: "name_asc" });
  const items = (result?.items ?? []).filter((p) => p.id !== exclude).slice(0, 4);
  if (items.length === 0) return null;
  return (
    <section className="related" aria-labelledby="related-title">
      <h2 id="related-title">Схожі товари</h2>
      <ProductTiles products={items} />
    </section>
  );
}

function JsonLd({ product }: { product: ProductDetails }) {
  const url = new URL(`/product/${product.slug}`, process.env.SITE_URL ?? "http://localhost:3000").toString();
  const data = {
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
  return (
    <script
      type="application/ld+json"
      // Екрануємо "<", щоб дані товару не могли закрити тег script.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
