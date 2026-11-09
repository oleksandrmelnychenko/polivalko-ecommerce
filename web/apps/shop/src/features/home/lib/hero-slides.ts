import type { Banner } from "@/features/content/server";
import { sized, type Sized } from "@polivalko/shared/lib/images";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";

export type HeroSlide = {
  key: string;
  image: Sized & { alt: string };
  mobileImage?: Sized;
  kind: "band" | "panel";
  kicker?: string;
  title: string;
  sub?: string;
  cta?: { href: string; label: string };
};

const HERO_SIZES = "(max-width: 40rem) 270px, (max-width: 60rem) 100vw, 1600px";

export const heroSlides: HeroSlide[] = [
  {
    key: "store",
    image: { ...sized(pagePhotos.hero.url, HERO_SIZES, 960), alt: pagePhotos.hero.alt },
    kind: "band",
    title: "Товари для саду, городу й дому",
    sub: "Відправляємо Новою поштою по всій Україні. Самовивіз з магазину безкоштовний.",
    cta: { href: "/catalog", label: "Перейти до каталогу" },
  },
  {
    key: "sale",
    image: { ...sized(pagePhotos.heroSale.url, HERO_SIZES, 960), alt: pagePhotos.heroSale.alt },
    kind: "panel",
    kicker: "Акції",
    title: "Товари зі знижкою",
    sub: "Усі товари зі зниженою ціною зібрані на одній сторінці.",
    cta: { href: "/sale", label: "Дивитися акції" },
  },
];

export function bannerSlides(banners: Banner[]): HeroSlide[] {
  return banners.map((banner, i) => {
    const link = banner.link?.trim();
    return {
      key: banner.id ?? `${i}-${banner.title}`,
      image: { ...sized(banner.imageUrl, HERO_SIZES, 960), alt: "" },
      mobileImage: banner.mobileImageUrl?.trim() ? sized(banner.mobileImageUrl.trim(), "100vw", 500) : undefined,
      kind: i % 2 === 0 ? "band" : "panel",
      kicker: banner.kicker?.trim() || undefined,
      title: banner.title,
      sub: banner.text?.trim() || undefined,
      cta: link ? { href: link, label: banner.buttonLabel?.trim() || "Переглянути" } : undefined,
    };
  });
}
