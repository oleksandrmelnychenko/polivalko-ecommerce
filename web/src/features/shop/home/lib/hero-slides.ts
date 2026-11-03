import { sized, type Sized } from "@/shared/lib/images";
import { pagePhotos } from "@/shared/lib/stand-in-photos";

export type HeroSlide = {
  image: Sized & { alt: string };
  kind: "band" | "panel";
  kicker: string;
  title: string;
  sub?: string;
  cta: { href: string; label: string };
};

const HERO_SIZES = "(max-width: 40rem) 270px, (max-width: 60rem) 100vw, 1600px";

export const heroSlides: HeroSlide[] = [
  {
    image: { ...sized(pagePhotos.hero.url, HERO_SIZES, 960), alt: pagePhotos.hero.alt },
    kind: "band",
    kicker: "Магазин у Бучі",
    title: "Усе для саду, городу й дому",
    sub: "Відправимо Новою поштою по всій Україні або підготуємо до самовивозу в Бучі",
    cta: { href: "/catalog", label: "Обрати товари" },
  },
  {
    image: { ...sized(pagePhotos.heroSale.url, HERO_SIZES, 960), alt: pagePhotos.heroSale.alt },
    kind: "panel",
    kicker: "Зараз дешевше",
    title: "Знижки для саду",
    sub: "Полив, інструмент і садова техніка за ціною, нижчою, ніж була",
    cta: { href: "/#offers-title", label: "Дивитися знижки" },
  },
];
