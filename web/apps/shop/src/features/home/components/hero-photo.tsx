import type { HeroSlide } from "../lib/hero-slides";

export function HeroPhoto({ slide, first }: { slide: HeroSlide; first: boolean }) {
  const img = (
    <img {...slide.image} alt={slide.image.alt || slide.title} width={1600} height={1067} className="hero-slide__photo" fetchPriority={first ? "high" : "low"} loading={first ? undefined : "lazy"} decoding="async" />
  );
  if (!slide.mobileImage) return img;
  return (
    <picture>
      <source media="(max-width: 40rem)" srcSet={slide.mobileImage.srcSet ?? slide.mobileImage.src} sizes={slide.mobileImage.sizes} />
      {img}
    </picture>
  );
}
