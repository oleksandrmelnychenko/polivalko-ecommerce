import { connection } from "next/server";
import { Suspense } from "react";
import { getSiteHome, SiteJsonLd, type SiteHome } from "@/features/content/server";
import { homeBlocks, type HomeBlockKey } from "../lib/home-blocks";
import { bannerSlides, heroSlides, type HeroSlide } from "../lib/hero-slides";
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
  const slides = home?.banners?.length ? bannerSlides(home.banners) : heroSlides;
  return (
    <>
      <SiteJsonLd />
      {!blocks.includes("hero") && <h1 className="visually-hidden">Poli Valko: товари для дому, саду та городу</h1>}
      {blocks.map((block) => (
        <HomeBlock key={block} block={block} home={home} slides={slides} />
      ))}
    </>
  );
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
