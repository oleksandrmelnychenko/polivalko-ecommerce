import { Suspense } from "react";
import { heroSlides } from "../lib/hero-slides";
import { CollectionPair } from "./collection-pair";
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
    <>
      <HeroSlider slides={heroSlides} />

      <Suspense fallback={<LookSkeleton />}>
        <OffersPair />
      </Suspense>
      <Suspense fallback={<LookSkeleton />}>
        <CollectionPair />
      </Suspense>
      <Suspense fallback={<LookSkeleton />}>
        <SectionsPair />
      </Suspense>

      <Perks />

      <Suspense fallback={<LookSkeleton />}>
        <ServicesLook />
      </Suspense>

      <Steps />

      <Suspense fallback={null}>
        <StoreVisit />
      </Suspense>
    </>
  );
}
