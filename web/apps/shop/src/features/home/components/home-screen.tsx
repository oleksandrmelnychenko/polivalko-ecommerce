import { connection } from "next/server";
import { Suspense } from "react";
import { getBestsellers, getCategoryTree, searchProducts } from "@/features/catalog/server";
import { getSiteHome, SiteJsonLd, type SiteHome } from "@/features/content/server";
import { homeBlocks, type HomeBlockKey } from "../lib/home-blocks";
import {
  bannerCategorySlugs,
  bannerSlides,
  bestsellerFeature,
  catalogSections,
  categorySubsections,
  findCategory,
  heroSlides,
  saleDeals,
  type HeroData,
  type HeroDeals,
  type HeroFeatured,
  type HeroSections,
  type HeroSlide,
  type HeroSubsections,
} from "../lib/hero-slides";
import { CollectionPairs } from "./collection-pair";
import { HeroSlider } from "./hero-slider";
import { LookSkeleton } from "./look-skeleton";
import { OffersPair } from "./offers-pair";
import { Perks } from "./perks";
import { SectionsPair } from "./sections-pair";
import { ServicesLook } from "./services-look";
import { Steps } from "./steps";
import { StoreVisit } from "./store-visit";

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
  const home = await getSiteHome();
  const blocks = homeBlocks(home?.blocks);
  const banners = home?.banners ?? [];
  const data = blocks.includes("hero") ? await heroData(bannerCategorySlugs(banners)) : {};
  const slides = banners.length ? bannerSlides(banners, data) : heroSlides(data);
  return (
    <>
      <SiteJsonLd />
      {!blocks.includes("hero") && <h1 className="visually-hidden">Poli Valko: товари для саду, городу й дому</h1>}
      {blocks.map((block) => (
        <HomeBlock key={block} block={block} home={home} slides={slides} />
      ))}
    </>
  );
}

async function heroData(categorySlugs: string[]): Promise<HeroData> {
  const [deals, sections, featured, categories] = await Promise.all([heroDeals(), heroSections(), heroFeatured(), heroCategories(categorySlugs)]);
  return { deals, sections, featured, categories };
}

async function heroCategories(slugs: string[]): Promise<Record<string, HeroSubsections>> {
  if (slugs.length === 0) return {};
  try {
    const tree = await getCategoryTree();
    const entries = await Promise.all(
      slugs.map(async (slug) => {
        const children = findCategory(tree, slug)?.children ?? [];
        const cheapest = await Promise.all(children.map((child) => searchProducts({ category: child.slug, inStock: true, sort: "price_asc", pageSize: 1 }).catch(() => null)));
        return [slug, categorySubsections(children, cheapest)] as const;
      }),
    );
    return Object.fromEntries(entries.filter((entry): entry is readonly [string, HeroSubsections] => entry[1] !== undefined));
  } catch {
    return {};
  }
}

async function heroDeals(): Promise<HeroDeals | undefined> {
  try {
    return saleDeals(await searchProducts({ onSale: true, inStock: true, sort: "price_asc", pageSize: 12 }));
  } catch {
    return undefined;
  }
}

async function heroSections(): Promise<HeroSections | undefined> {
  try {
    const [categories, all] = await Promise.all([getCategoryTree(), searchProducts({ pageSize: 1 })]);
    return catalogSections(categories, all?.totalItems ?? null);
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

function HomeBlock({ block, home, slides }: { block: HomeBlockKey; home: SiteHome | null; slides: HeroSlide[] }) {
  switch (block) {
    case "hero":
      return <HeroSlider slides={slides} />;
    case "offers":
      return (
        <Suspense fallback={<LookSkeleton />}>
          <OffersPair />
        </Suspense>
      );
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
      return <Perks items={home?.perks} />;
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
