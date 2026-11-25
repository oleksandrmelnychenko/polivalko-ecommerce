import { connection } from "next/server";
import { formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";
import { Suspense } from "react";
import { getBestsellers, getCategoryTree, searchProducts } from "@/features/catalog/server";
import type { ProductListItem } from "@polivalko/shared/api/types";
import { enabledDeliveryFacts, getSiteHome, SiteJsonLd, type SiteHome, type Banner } from "@/features/content/server";
import type { DeliveryFacts } from "@/shared/lib/delivery-facts";
import { homeBlocks, type HomeBlockKey } from "../lib/home-blocks";
import {
  bannerSlides,
  bannerCategorySlugs,
  categorySubsections,
  findCategory,
  bestsellerFeature,
  heroSlides,
  saleDeals,
  type HeroData,
  type HeroDeals,
  type HeroFeatured,
  type HeroSlide,
} from "../lib/hero-slides";
import { CollectionPairs } from "./collection-pair";
import { HeroSlider } from "./hero-slider";
import { LookSkeleton } from "./look-skeleton";
import { Perks } from "./perks";
import { SectionsPair } from "./sections-pair";
import { ServicesLook } from "./services-look";
import { Steps } from "./steps";
import { StoreVisit } from "./store-visit";
import { HomeFaq } from "./home-faq";
import { JournalPreview } from "@/features/journal/server";

export function HomeScreen() {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeSkeleton() {
  return (
    <>
      <div className="hero" aria-hidden="true" />
      <LookSkeleton />
    </>
  );
}

async function HomeContent() {
  await connection();
  const home = await getSiteHome().catch(() => null);
  const blocks = homeBlocks(home?.blocks);
  const banners = home?.banners ?? [];
  const needsFacts = blocks.includes("perks") && !home?.perks?.some((p) => p.title?.trim());
  const [data, facts] = await Promise.all([
    blocks.includes("hero") ? heroData(banners) : Promise.resolve<HeroData>({}),
    needsFacts ? enabledDeliveryFacts() : Promise.resolve(null),
  ]);
  const fromBanners = bannerSlides(banners, data);
  const slides = fromBanners.length ? fromBanners : heroSlides(data);
  return (
    <>
      <SiteJsonLd />
      <h1 className="visually-hidden">Poli Valko: товари для саду, городу й дому</h1>
      {blocks.map((block) => (
        <HomeBlock key={block} block={block} home={home} slides={slides} facts={facts} />
      ))}
      <JournalPreview />
      <HomeFaq />
    </>
  );
}

async function heroData(banners: Banner[]): Promise<HeroData> {
  const [deals, featured, storeFeatured, categoryData] = await Promise.all([heroDeals(), heroFeatured(), heroStoreFeatured(), heroCategories(banners)]);
  return { deals, featured, storeFeatured, ...categoryData };
}

async function heroCategories(banners: Banner[]): Promise<Pick<HeroData, "categories" | "categoryFeatured">> {
  const slugs = bannerCategorySlugs(banners);
  if (!slugs.length) return {};
  const tree = await getCategoryTree().catch(() => []);
  const entries = await Promise.all(slugs.map(async (slug) => {
    const children = findCategory(tree, slug)?.children.slice(0, 3) ?? [];
    const products = await Promise.all(children.map(child => searchProducts({ category: child.slug, inStock: true, pageSize: 1 }).catch(() => null)));
    return { slug, subsections: categorySubsections(children, products), featured: catalogFeature(products[0]?.items[0]) };
  }));
  return {
    categories: Object.fromEntries(entries.flatMap(item => item.subsections ? [[item.slug, item.subsections]] : [])),
    categoryFeatured: Object.fromEntries(entries.flatMap(item => item.featured ? [[item.slug, item.featured]] : [])),
  };
}

async function heroStoreFeatured(): Promise<HeroFeatured | undefined> {
  const result = await searchProducts({ category: "vse-dlia-vidpochynku", q: "меблів", inStock: true, pageSize: 1 }).catch(() => null);
  return catalogFeature(result?.items[0]);
}

function catalogFeature(product: ProductListItem | undefined): HeroFeatured | undefined {
  if (!product) return undefined;
  return {
    href: `/product/${product.slug}`, name: product.name, brand: product.brand ?? null,
    image: product.imageUrl ? thumb(product.imageUrl, 250) : null,
    price: formatMoney(product.price), oldPrice: null, percent: null, note: "З нашого каталогу",
  };
}

async function heroDeals(): Promise<HeroDeals | undefined> {
  try {
    return saleDeals(await searchProducts({ onSale: true, inStock: true, sort: "price_asc", pageSize: 12 }));
  } catch {
    return undefined;
  }
}

async function heroFeatured(): Promise<HeroFeatured | undefined> {
  try {
    return bestsellerFeature(await getBestsellers(1));
  } catch {
    return undefined;
  }
}

function HomeBlock({ block, home, slides, facts }: { block: HomeBlockKey; home: SiteHome | null; slides: HeroSlide[]; facts: DeliveryFacts | null }) {
  switch (block) {
    case "hero":
      return <HeroSlider slides={slides} />;
    case "offers":
      return null;
    case "collections":
      return (
        <Suspense fallback={<LookSkeleton />}>
          <CollectionPairs />
        </Suspense>
      );
    case "categories":
      return (
        <Suspense fallback={<LookSkeleton />}>
          <SectionsPair />
        </Suspense>
      );
    case "perks":
      return <Perks items={home?.perks} facts={facts} />;
    case "services":
      return (
        <Suspense fallback={<LookSkeleton />}>
          <ServicesLook />
        </Suspense>
      );
    case "steps":
      return <Steps items={home?.steps} />;
    case "visit":
      return (
        <Suspense fallback={null}>
          <StoreVisit visit={home?.visit} />
        </Suspense>
      );
  }
}
