import { categoryPhotoUrl, discountPercent } from "@/features/catalog";
import type { Banner } from "@/features/content/server";
import type { Bestsellers, CategoryNode, ProductSearch } from "@polivalko/shared/api/types";
import { countProducts, formatMoney, plural } from "@polivalko/shared/lib/format";
import { sized, thumb, type Sized } from "@polivalko/shared/lib/images";
import { pagePhotos } from "@polivalko/shared/lib/stand-in-photos";

export type HeroDeal = { id: string; href: string; name: string; image: string | null; price: string; oldPrice: string; percent: number };

export type HeroDeals = { total: number; items: HeroDeal[] };

export type HeroSection = { id: string; href: string; name: string; image: string | null };

export type HeroSections = { line: string | null; items: HeroSection[] };

export type HeroFeatured = { href: string; name: string; brand: string | null; image: string | null; price: string; oldPrice: string | null; percent: number | null; note: string | null };

export type HeroSubsection = { id: string; href: string; name: string; image: string | null; count: string; from: string | null };

export type HeroSubsections = { line: string | null; items: HeroSubsection[] };

export type HeroData = {
  deals?: HeroDeals;
  sections?: HeroSections;
  featured?: HeroFeatured;
  categories?: Record<string, HeroSubsections>;
};

export type HeroSlide = {
  key: string;
  image: Sized & { alt: string };
  mobileImage?: Sized;
  side: "left" | "right";
  kicker?: string;
  title: string;
  sub?: string;
  deals?: HeroDeals;
  sections?: HeroSections;
  featured?: HeroFeatured;
  subsections?: HeroSubsections;
  cta?: { href: string; label: string };
};

const HERO_SIZES = "(max-width: 40rem) 270px, (max-width: 60rem) 100vw, 1600px";

const DEALS_SHOWN = 3;

const SECTIONS_SHOWN = 8;

const SUBSECTIONS_SHOWN = 4;

const SALE_LINK = /^\/sale(?:[/?#]|$)/;

const CATALOG_LINK = /^\/catalog\/?(?:[?#]|$)/;

const CATEGORY_LINK = /^\/catalog\/([^/?#]+)\/?(?:[?#]|$)/;

const BESTSELLER_LINK = /^\/bestseller\/?(?:[?#]|$)/;

const ORDERS_NOTE_FROM = 3;

const dealsLine = (deals: HeroDeals) => `${countProducts(deals.total)} зі зниженою ціною`;

function sectionsWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "розділі" : "розділах";
}

function subsectionsWord(n: number): string {
  return n % 10 === 1 && n % 100 !== 11 ? "підрозділі" : "підрозділах";
}

export function bannerCategorySlugs(banners: Banner[]): string[] {
  const slugs = banners.map((banner) => banner.link?.trim().match(CATEGORY_LINK)?.[1]).filter((slug): slug is string => Boolean(slug));
  return [...new Set(slugs)];
}

export function findCategory(categories: CategoryNode[], slug: string): CategoryNode | undefined {
  for (const category of categories) {
    if (category.slug === slug) return category;
    const nested = findCategory(category.children, slug);
    if (nested) return nested;
  }
  return undefined;
}

export function saleDeals(sale: ProductSearch | null): HeroDeals | undefined {
  const items: HeroDeal[] = [];
  for (const product of sale?.items ?? []) {
    const percent = discountPercent(product.price, product.oldPrice);
    if (percent === null || !product.oldPrice) continue;
    items.push({
      id: product.id,
      href: `/product/${product.slug}`,
      name: product.name,
      image: product.imageUrl ? thumb(product.imageUrl, 120) : null,
      price: formatMoney(product.price),
      oldPrice: formatMoney(product.oldPrice),
      percent,
    });
  }
  if (items.length === 0) return undefined;
  items.sort((a, b) => b.percent - a.percent);
  return { total: Math.max(sale?.totalItems ?? 0, items.length), items: items.slice(0, DEALS_SHOWN) };
}

export function catalogSections(categories: CategoryNode[], totalProducts: number | null): HeroSections | undefined {
  if (categories.length === 0) return undefined;
  const items = categories.slice(0, SECTIONS_SHOWN).map((category) => {
    const photo = categoryPhotoUrl(category);
    return { id: category.id, href: `/catalog/${category.slug}`, name: category.name, image: photo ? thumb(photo, 120) : null };
  });
  const line = totalProducts ? `${countProducts(totalProducts)} у ${categories.length} ${sectionsWord(categories.length)}` : null;
  return { line, items };
}

export function categorySubsections(children: CategoryNode[], cheapest: (ProductSearch | null)[]): HeroSubsections | undefined {
  const items: HeroSubsection[] = [];
  let total = 0;
  children.forEach((child, i) => {
    const result = cheapest[i];
    const count = result?.totalItems ?? 0;
    if (count === 0) return;
    total += count;
    const product = result?.items[0];
    const photo = child.imageUrl?.trim() || product?.imageUrl || null;
    items.push({
      id: child.id,
      href: `/catalog/${child.slug}`,
      name: child.name,
      image: photo ? thumb(photo, 120) : null,
      count: `${countProducts(count)} у наявності`,
      from: product ? `від ${formatMoney(product.price)}` : null,
    });
  });
  if (items.length === 0) return undefined;
  const shown = items.slice(0, SUBSECTIONS_SHOWN);
  return { line: `${countProducts(total)} у ${items.length} ${subsectionsWord(items.length)}`, items: shown };
}

export function bestsellerFeature(response: Bestsellers | null): HeroFeatured | undefined {
  const top = response?.items[0];
  if (!top) return undefined;
  const product = top.product;
  const percent = discountPercent(product.price, product.oldPrice);
  return {
    href: `/product/${product.slug}`,
    name: product.name,
    brand: product.brand ?? null,
    image: product.imageUrl ? thumb(product.imageUrl, 250) : null,
    price: formatMoney(product.price),
    oldPrice: percent !== null && product.oldPrice ? formatMoney(product.oldPrice) : null,
    percent,
    note: top.orders >= ORDERS_NOTE_FROM ? `Замовляли ${top.orders} ${plural(top.orders, "раз", "рази", "разів")} за останні ${response.periodDays} днів` : null,
  };
}

export function heroSlides({ deals, sections, featured }: HeroData): HeroSlide[] {
  return [
    {
      key: "store",
      image: { ...sized(pagePhotos.hero.url, HERO_SIZES, 960), alt: pagePhotos.hero.alt },
      side: "left",
      title: "Товари для саду, городу й дому",
      sub: "Відправляємо Новою поштою по всій Україні. Самовивіз з магазину безкоштовний.",
      sections,
      cta: { href: "/catalog", label: "Перейти до каталогу" },
    },
    featured
      ? {
          key: "bestseller",
          image: { ...sized(pagePhotos.heroSale.url, HERO_SIZES, 960), alt: pagePhotos.heroSale.alt },
          side: "right",
          kicker: "Хіт продажів",
          title: "Найчастіше купують",
          featured,
          cta: { href: featured.href, label: "Переглянути товар" },
        }
      : {
          key: "sale",
          image: { ...sized(pagePhotos.heroSale.url, HERO_SIZES, 960), alt: pagePhotos.heroSale.alt },
          side: "right",
          kicker: "Акції",
          title: "Товари зі знижкою",
          sub: deals ? dealsLine(deals) : "Усі товари зі зниженою ціною зібрані на одній сторінці.",
          deals,
          cta: { href: "/sale", label: "Дивитися акції" },
        },
  ];
}

export function bannerSlides(banners: Banner[], { deals, sections, featured, categories }: HeroData): HeroSlide[] {
  return banners.map((banner, i) => {
    const link = banner.link?.trim();
    const side = i % 2 === 0 ? "left" : "right";
    const bannerDeals = link && SALE_LINK.test(link) ? deals : undefined;
    const bannerSections = link && CATALOG_LINK.test(link) ? sections : undefined;
    const bannerFeatured = link && BESTSELLER_LINK.test(link) ? featured : undefined;
    const categorySlug = link?.match(CATEGORY_LINK)?.[1];
    const bannerSubsections = categorySlug ? categories?.[categorySlug] : undefined;
    return {
      key: banner.id ?? `${i}-${banner.title}`,
      image: { ...sized(banner.imageUrl, HERO_SIZES, 960), alt: "" },
      mobileImage: banner.mobileImageUrl?.trim() ? sized(banner.mobileImageUrl.trim(), "100vw", 500) : undefined,
      side,
      kicker: banner.kicker?.trim() || undefined,
      title: banner.title,
      sub: bannerDeals ? dealsLine(bannerDeals) : banner.text?.trim() || undefined,
      deals: bannerDeals,
      sections: bannerSections,
      featured: bannerFeatured,
      subsections: bannerSubsections,
      cta: link ? { href: bannerFeatured?.href ?? link, label: banner.buttonLabel?.trim() || "Переглянути" } : undefined,
    };
  });
}
