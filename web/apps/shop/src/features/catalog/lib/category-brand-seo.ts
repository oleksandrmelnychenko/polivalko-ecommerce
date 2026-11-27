import { countProducts } from "@polivalko/shared/lib/format";
import { clip } from "@/shared/lib/clip";
import { PAGE_SIZES, type SearchParams } from "./listing-params";

/** Minimum products required in a Category × Brand intersection to be indexed & included in sitemaps. */
export const MIN_PRODUCTS_FOR_CATEGORY_BRAND = 3;

const DEFAULT_SORT = "recommended";
const DEFAULT_PAGE_SIZE = PAGE_SIZES[0];

const TRACKING_PARAM_PREFIXES = ["utm_", "mtm_", "pk_"];
const TRACKING_PARAM_EXACT = new Set([
  "fbclid",
  "gclid",
  "gbraid",
  "wbraid",
  "dclid",
  "yclid",
  "msclkid",
  "ttclid",
  "srsltid",
  "_gl",
  "_ga",
  "ref",
]);

const KNOWN_CATALOG_PARAMS = new Set([
  "brand",
  "f",
  "inStock",
  "onSale",
  "priceMin",
  "priceMax",
  "sort",
  "pageSize",
  "page",
]);

/**
 * Brand slugs that already exist as dedicated subcategories in the catalog
 * (`/catalog/hunter` and `/catalog/irritec` under `/catalog/pidzemnyi-polyv`).
 * Redirect to the canonical subcategory URL instead of serving duplicate `/catalog/<parent>/<brand>` pages.
 */
export const DUPLICATE_SUBCATEGORY_BRANDS: Readonly<Record<string, string>> = {
  "pidzemnyi-polyv::hunter": "/catalog/hunter",
  "pidzemnyi-polyv::irritec": "/catalog/irritec",
};

export interface CategoryBrandSeedEntry {
  categorySlug: string;
  categoryName: string;
  brandSlug: string;
  brandName: string;
  priority: "P1" | "P2";
  intentNote: string;
}

/** Curated Category × Brand landing pairs, excluding brands that already have dedicated subcategories. */
export const CATEGORY_BRAND_PRIORITY_MATRIX: readonly CategoryBrandSeedEntry[] = [
  { categorySlug: "vse-dlia-polyvu", categoryName: "Все для поливу", brandSlug: "irritec", brandName: "Irritec", priority: "P1", intentNote: "Італійські системи поливу Irritec (98 SKU)" },
  { categorySlug: "vse-dlia-polyvu", categoryName: "Все для поливу", brandSlug: "cellfast", brandName: "Cellfast", priority: "P1", intentNote: "Шланги, конектори, дощувачі Cellfast" },
  { categorySlug: "vse-dlia-polyvu", categoryName: "Все для поливу", brandSlug: "hunter", brandName: "Hunter", priority: "P1", intentNote: "Обладнання автополиву Hunter (68 SKU)" },
  { categorySlug: "vse-dlia-polyvu", categoryName: "Все для поливу", brandSlug: "gardena", brandName: "Gardena", priority: "P1", intentNote: "Поливальні системи Gardena" },
  { categorySlug: "vse-dlia-polyvu", categoryName: "Все для поливу", brandSlug: "presto-ps", brandName: "Presto-PS", priority: "P1", intentNote: "Крапельний полив та фітинги Presto-PS (36 SKU)" },
  { categorySlug: "krapelnyi-polyv", categoryName: "Крапельний полив", brandSlug: "irritec", brandName: "Irritec", priority: "P1", intentNote: "Крапельна стрічка, трубки, фільтри Irritec" },
  { categorySlug: "krapelnyi-polyv", categoryName: "Крапельний полив", brandSlug: "presto-ps", brandName: "Presto-PS", priority: "P1", intentNote: "Стрічка та фітинги крапельного поливу Presto-PS" },
  { categorySlug: "shlanhy", categoryName: "Шланги", brandSlug: "cellfast", brandName: "Cellfast", priority: "P1", intentNote: "Армовані поливальні шланги Cellfast" },
  { categorySlug: "shlanhy", categoryName: "Шланги", brandSlug: "gardena", brandName: "Gardena", priority: "P1", intentNote: "Садові шланги Gardena" },
  { categorySlug: "doshchuvachi", categoryName: "Дощувачі", brandSlug: "cellfast", brandName: "Cellfast", priority: "P1", intentNote: "Дощувачі для газону Cellfast" },
  { categorySlug: "doshchuvachi", categoryName: "Дощувачі", brandSlug: "gardena", brandName: "Gardena", priority: "P1", intentNote: "Маятникові та кругові дощувачі Gardena" },
  { categorySlug: "ruchnyi-instrument", categoryName: "Ручний інструмент", brandSlug: "fiskars", brandName: "Fiskars", priority: "P1", intentNote: "Садовий інструмент Fiskars (90 SKU)" },
  { categorySlug: "ruchnyi-instrument", categoryName: "Ручний інструмент", brandSlug: "truper", brandName: "Truper", priority: "P1", intentNote: "Садовий інструмент Truper (50 SKU)" },
  { categorySlug: "ruchnyi-instrument", categoryName: "Ручний інструмент", brandSlug: "gruntek", brandName: "GRÜNTEK", priority: "P1", intentNote: "Секатори та інструмент GRÜNTEK (37 SKU)" },
  { categorySlug: "ruchnyi-instrument", categoryName: "Ручний інструмент", brandSlug: "spear-jackson", brandName: "Spear & Jackson", priority: "P2", intentNote: "Британський садовий інструмент Spear & Jackson (31 SKU)" },
  { categorySlug: "ruchnyi-instrument", categoryName: "Ручний інструмент", brandSlug: "cellfast", brandName: "Cellfast", priority: "P2", intentNote: "Ручний садовий інструмент Cellfast" },
  { categorySlug: "sekatory-suchkorizy-y-nozhytsi", categoryName: "Секатори, сучкорізи й ножиці", brandSlug: "fiskars", brandName: "Fiskars", priority: "P1", intentNote: "Секатори й сучкорізи Fiskars" },
  { categorySlug: "sekatory-suchkorizy-y-nozhytsi", categoryName: "Секатори, сучкорізи й ножиці", brandSlug: "gardena", brandName: "Gardena", priority: "P1", intentNote: "Секатори й гілкорізи Gardena" },
  { categorySlug: "sekatory-suchkorizy-y-nozhytsi", categoryName: "Секатори, сучкорізи й ножиці", brandSlug: "gruntek", brandName: "GRÜNTEK", priority: "P1", intentNote: "Секатори GRÜNTEK" },
  { categorySlug: "dobryva", categoryName: "Добрива", brandSlug: "agrecol", brandName: "Agrecol", priority: "P1", intentNote: "Добрива для газону й саду Agrecol (36 SKU)" },
  { categorySlug: "dobryva", categoryName: "Добрива", brandSlug: "icl", brandName: "ICL", priority: "P1", intentNote: "Професійні добрива пролонгованої дії ICL (29 SKU)" },
  { categorySlug: "dobryva", categoryName: "Добрива", brandSlug: "valagro", brandName: "Valagro", priority: "P1", intentNote: "Біостимулятори та добрива Valagro (19 SKU)" },
  { categorySlug: "dobryva", categoryName: "Добрива", brandSlug: "rosasol", brandName: "Rosasol", priority: "P2", intentNote: "Водорозчинні добрива Rosasol (28 SKU)" },
  { categorySlug: "dobryva", categoryName: "Добрива", brandSlug: "kvitofor", brandName: "Kvitofor", priority: "P2", intentNote: "Мінеральні добрива Kvitofor (27 SKU)" },
  { categorySlug: "dobryva", categoryName: "Добрива", brandSlug: "quantum", brandName: "Quantum", priority: "P2", intentNote: "Хелатні добрива Quantum (18 SKU)" },
  { categorySlug: "zasoby-zakhystu-roslyn", categoryName: "Засоби захисту рослин", brandSlug: "simeinyi-sad", brandName: "Сімейний Сад", priority: "P1", intentNote: "ЗЗР Сімейний Сад (61 SKU)" },
  { categorySlug: "zasoby-zakhystu-roslyn", categoryName: "Засоби захисту рослин", brandSlug: "syngenta", brandName: "Syngenta", priority: "P1", intentNote: "Фунгіциди та інсектициди Syngenta (15 SKU)" },
  { categorySlug: "zasoby-zakhystu-roslyn", categoryName: "Засоби захисту рослин", brandSlug: "btu-tsentr", brandName: "БТУ-Центр", priority: "P2", intentNote: "Біопрепарати БТУ-Центр (12 SKU)" },
  { categorySlug: "nasinnia", categoryName: "Насіння", brandSlug: "seedera", brandName: "SeedEra", priority: "P1", intentNote: "Насіння овочів і квітів SeedEra (1648 SKU)" },
  { categorySlug: "horshchyky", categoryName: "Горщики", brandSlug: "aleana", brandName: "Алеана", priority: "P1", intentNote: "Горщики й кашпо Алеана (52 SKU)" },
  { categorySlug: "horshchyky", categoryName: "Горщики", brandSlug: "serinova", brandName: "Serinova", priority: "P2", intentNote: "Вазони та горщики Serinova (12 SKU)" },
  { categorySlug: "hrunty-ta-dobavky", categoryName: "Ґрунти та добавки", brandSlug: "peatfield", brandName: "PEATFIELD", priority: "P1", intentNote: "Торф’яні субстрати PEATFIELD (14 SKU)" },
  { categorySlug: "shkidnyky", categoryName: "Шкідники", brandSlug: "bros", brandName: "BROS", priority: "P1", intentNote: "Засоби від гризунів і комах BROS" },
  { categorySlug: "tekhnika-dlia-sadu-ta-horodu", categoryName: "Техніка для саду та городу", brandSlug: "werk", brandName: "Werk", priority: "P2", intentNote: "Садова техніка та обладнання Werk (37 SKU)" },
];

const PRIORITY_PAIR_SET = new Set(
  CATEGORY_BRAND_PRIORITY_MATRIX.map((entry) => `${entry.categorySlug}::${entry.brandSlug}`),
);

export function normalizeBrandSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Returns the canonical subcategory URL if `(categorySlug, brandSlug)` duplicates an existing
 * category node (e.g., `pidzemnyi-polyv` + `hunter` -> `/catalog/hunter`, or `hunter` + `hunter` -> `/catalog/hunter`).
 */
export function duplicateSubcategoryRedirect(categorySlug: string, brandSlug: string): string | null {
  const cat = categorySlug.trim().toLowerCase();
  const brand = normalizeBrandSlug(brandSlug);
  if (!cat || !brand) return null;
  if (cat === brand) return `/catalog/${cat}`;
  return DUPLICATE_SUBCATEGORY_BRANDS[`${cat}::${brand}`] ?? null;
}

/** Clean canonical destination for a brand chip inside a category (reuses L3 subcategory where one exists). */
export function categoryBrandHref(categorySlug: string, brandSlug: string): string {
  const brand = normalizeBrandSlug(brandSlug);
  return duplicateSubcategoryRedirect(categorySlug, brand) ?? `/catalog/${categorySlug}/${brand}`;
}

export function isPriorityCategoryBrand(categorySlug: string, brandSlug: string): boolean {
  return PRIORITY_PAIR_SET.has(`${categorySlug.trim().toLowerCase()}::${normalizeBrandSlug(brandSlug)}`);
}

export interface CatalogIndexabilityInput {
  routeType: "category" | "category_brand" | "brand_hub" | "sale";
  categorySlug?: string;
  brandSlug?: string;
  searchParams?: SearchParams;
  totalProducts: number;
  minProductsForLanding?: number;
  /** Optional allowlist check. On `category_brand` / `brand_hub`, defaults to true (threshold + duplicate guards still apply). */
  isAllowlistedBrandLanding?: (categorySlug: string | undefined, brandSlug: string) => boolean;
}

export interface CatalogIndexabilityDecision {
  index: boolean;
  follow: boolean;
  robots: { index: boolean; follow: boolean };
  canonicalPath: string;
  page: number;
  inSitemap: boolean;
  redirectTo: string | null;
  reason:
    | "clean_indexable"
    | "clean_pagination_indexable"
    | "redirect_duplicate_brand_subcategory"
    | "redirect_legacy_brand_query_to_clean_landing"
    | "noindex_non_allowlisted_single_brand_query"
    | "noindex_multi_brand_or_faceted_filter"
    | "noindex_sort_or_pagesize"
    | "noindex_unknown_query_param"
    | "noindex_below_product_threshold"
    | "noindex_not_allowlisted_landing";
  activeFilterKeys: string[];
}

function isTrackingParam(key: string): boolean {
  const lower = key.toLowerCase();
  if (TRACKING_PARAM_EXACT.has(lower)) return true;
  return TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

function toValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).map((v) => v.trim()).filter(Boolean);
}

function buildBasePath(input: CatalogIndexabilityInput): string {
  switch (input.routeType) {
    case "sale":
      return "/sale";
    case "category":
      if (!input.categorySlug) throw new Error("categorySlug is required for routeType='category'");
      return `/catalog/${input.categorySlug}`;
    case "category_brand":
      if (!input.categorySlug || !input.brandSlug) {
        throw new Error("categorySlug and brandSlug are required for routeType='category_brand'");
      }
      return `/catalog/${input.categorySlug}/${normalizeBrandSlug(input.brandSlug)}`;
    case "brand_hub":
      if (!input.brandSlug) throw new Error("brandSlug is required for routeType='brand_hub'");
      return `/brands/${normalizeBrandSlug(input.brandSlug)}`;
  }
}

/**
 * Pure, deterministic robots & canonical matrix for all catalog, Category × Brand, and Brand Hub pages.
 * Guarantees zero index-bloat loopholes across multi-filters, tracking parameters, thin pages, and
 * duplicate subcategory-brand intersections.
 */
export function resolveCatalogRobotsAndCanonical(input: CatalogIndexabilityInput): CatalogIndexabilityDecision {
  const basePath = buildBasePath(input);
  const minProducts = input.minProductsForLanding ?? MIN_PRODUCTS_FOR_CATEGORY_BRAND;
  const rawParams = input.searchParams ?? {};

  // 1. Duplicate L3 subcategory guard (e.g. /catalog/pidzemnyi-polyv/hunter -> /catalog/hunter)
  if (input.routeType === "category_brand" && input.categorySlug && input.brandSlug) {
    const duplicateTarget = duplicateSubcategoryRedirect(input.categorySlug, input.brandSlug);
    if (duplicateTarget) {
      return {
        index: false,
        follow: true,
        robots: { index: false, follow: true },
        canonicalPath: duplicateTarget,
        page: 1,
        inSitemap: false,
        redirectTo: duplicateTarget,
        reason: "redirect_duplicate_brand_subcategory",
        activeFilterKeys: [],
      };
    }
  }

  // 2. Strip empty values and harmless marketing/tracking parameters
  const effectiveEntries: Array<[string, string[]]> = [];
  for (const [key, rawVal] of Object.entries(rawParams)) {
    if (isTrackingParam(key)) continue;
    const values = toValues(rawVal);
    if (values.length === 0) continue;
    effectiveEntries.push([key, values]);
  }

  // 3. Parse pagination (only positive integers > 1 keep ?page=N)
  const rawPage = toValues(rawParams.page)[0];
  const parsedPage = rawPage !== undefined && /^\d+$/.test(rawPage) ? Number(rawPage) : 1;
  const page = Number.isInteger(parsedPage) && parsedPage > 1 ? parsedPage : 1;

  // 4. Classify non-page parameters
  const activeFilterKeys: string[] = [];
  let hasUnknownParam = false;
  let hasSortOrPageSizeOverride = false;
  let brands: string[] = [];

  for (const [key, values] of effectiveEntries) {
    if (key === "page") continue;

    if (!KNOWN_CATALOG_PARAMS.has(key)) {
      hasUnknownParam = true;
      activeFilterKeys.push(key);
      continue;
    }

    if (key === "brand") {
      brands = values
        .flatMap((v) => v.split(","))
        .map((v) => v.trim())
        .filter(Boolean);
      if (brands.length > 0) activeFilterKeys.push("brand");
      continue;
    }

    if (key === "sort") {
      if (values[0] !== DEFAULT_SORT) {
        hasSortOrPageSizeOverride = true;
        activeFilterKeys.push("sort");
      }
      continue;
    }

    if (key === "pageSize") {
      const sizeNum = Number(values[0]);
      const defaultSize = input.routeType === "sale" ? 20 : DEFAULT_PAGE_SIZE;
      if (sizeNum !== defaultSize) {
        hasSortOrPageSizeOverride = true;
        activeFilterKeys.push("pageSize");
      }
      continue;
    }

    if (key === "inStock" || key === "onSale") {
      if (values.some((v) => v.toLowerCase() === "true" || v === "1")) {
        activeFilterKeys.push(key);
      }
      continue;
    }

    // `f`, `priceMin`, `priceMax`
    activeFilterKeys.push(key);
  }

  // 5. Dedicated landing allowlist & thin-page product threshold guard
  if (input.routeType === "category_brand" || input.routeType === "brand_hub") {
    const fallbackCanonical =
      input.routeType === "category_brand" ? `/catalog/${input.categorySlug}` : "/brands";

    const allowlisted = input.isAllowlistedBrandLanding
      ? input.isAllowlistedBrandLanding(input.categorySlug, normalizeBrandSlug(input.brandSlug!))
      : true;

    if (!allowlisted) {
      return {
        index: false,
        follow: true,
        robots: { index: false, follow: true },
        canonicalPath: fallbackCanonical,
        page,
        inSitemap: false,
        redirectTo: null,
        reason: "noindex_not_allowlisted_landing",
        activeFilterKeys,
      };
    }

    if (input.totalProducts < minProducts) {
      return {
        index: false,
        follow: true,
        robots: { index: false, follow: true },
        canonicalPath: fallbackCanonical,
        page,
        inSitemap: false,
        redirectTo: null,
        reason: "noindex_below_product_threshold",
        activeFilterKeys,
      };
    }
  }

  // 6. Unknown query params -> noindex, follow, canonical to clean base
  if (hasUnknownParam) {
    return {
      index: false,
      follow: true,
      robots: { index: false, follow: true },
      canonicalPath: basePath,
      page,
      inSitemap: false,
      redirectTo: null,
      reason: "noindex_unknown_query_param",
      activeFilterKeys,
    };
  }

  // 7. Legacy single-brand filter `/catalog/[slug]?brand=irritec` (and NO other filters)
  if (
    input.routeType === "category" &&
    input.categorySlug &&
    activeFilterKeys.length === 1 &&
    activeFilterKeys[0] === "brand" &&
    brands.length === 1
  ) {
    const normalizedBrand = normalizeBrandSlug(brands[0]);
    const duplicateTarget = duplicateSubcategoryRedirect(input.categorySlug, normalizedBrand);
    if (duplicateTarget) {
      const targetUrl = page > 1 ? `${duplicateTarget}?page=${page}` : duplicateTarget;
      return {
        index: true,
        follow: true,
        robots: { index: true, follow: true },
        canonicalPath: targetUrl,
        page,
        inSitemap: false,
        redirectTo: targetUrl,
        reason: "redirect_duplicate_brand_subcategory",
        activeFilterKeys,
      };
    }

    const allowlisted =
      normalizedBrand.length > 0 &&
      (input.isAllowlistedBrandLanding
        ? input.isAllowlistedBrandLanding(input.categorySlug, normalizedBrand)
        : isPriorityCategoryBrand(input.categorySlug, normalizedBrand));

    if (allowlisted && input.totalProducts >= minProducts) {
      const cleanLanding = `/catalog/${input.categorySlug}/${normalizedBrand}`;
      const targetUrl = page > 1 ? `${cleanLanding}?page=${page}` : cleanLanding;
      return {
        index: true,
        follow: true,
        robots: { index: true, follow: true },
        canonicalPath: targetUrl,
        page,
        inSitemap: false,
        redirectTo: targetUrl,
        reason: "redirect_legacy_brand_query_to_clean_landing",
        activeFilterKeys,
      };
    }

    return {
      index: false,
      follow: true,
      robots: { index: false, follow: true },
      canonicalPath: basePath,
      page,
      inSitemap: false,
      redirectTo: null,
      reason: "noindex_non_allowlisted_single_brand_query",
      activeFilterKeys,
    };
  }

  // 8. Any active filter, multi-brand, facet, sort, or pageSize override -> noindex, follow, canonical to clean base
  if (activeFilterKeys.length > 0) {
    const onlySortOrPageSize =
      hasSortOrPageSizeOverride &&
      activeFilterKeys.every((k) => k === "sort" || k === "pageSize");

    return {
      index: false,
      follow: true,
      robots: { index: false, follow: true },
      canonicalPath: basePath,
      page,
      inSitemap: false,
      redirectTo: null,
      reason: onlySortOrPageSize
        ? "noindex_sort_or_pagesize"
        : "noindex_multi_brand_or_faceted_filter",
      activeFilterKeys,
    };
  }

  // 9. Clean pagination (`?page=2+`) -> index, follow, paginated canonical, excluded from XML sitemap
  if (page > 1) {
    return {
      index: true,
      follow: true,
      robots: { index: true, follow: true },
      canonicalPath: `${basePath}?page=${page}`,
      page,
      inSitemap: false,
      redirectTo: null,
      reason: "clean_pagination_indexable",
      activeFilterKeys: [],
    };
  }

  // 10. Clean page 1 -> index, follow, self-canonical, eligible for XML sitemap
  return {
    index: true,
    follow: true,
    robots: { index: true, follow: true },
    canonicalPath: basePath,
    page: 1,
    inSitemap: true,
    redirectTo: null,
    reason: "clean_indexable",
    activeFilterKeys: [],
  };
}

/**
 * Generates clean, non-truncated Ukrainian SEO title & meta description for `/catalog/[slug]/[brand]`.
 * Accounts for ` | Poli Valko` (13 chars) appended by `seoMetadata` so rendered `<title>` stays within ~45-60 chars.
 */
export function categoryBrandSeoMeta(params: {
  categoryName: string;
  brandName: string;
  productCount: number;
  page?: number;
}): { title: string; description: string; h1: string } {
  const { categoryName, brandName, productCount, page = 1 } = params;
  const h1 = `${categoryName} ${brandName}`;

  const rawTitle =
    page > 1
      ? `${h1}, сторінка ${page}`
      : `${h1} — купити в Україні`.length <= 47
        ? `${h1} — купити в Україні`
        : `${h1} — купити`.length <= 47
          ? `${h1} — купити`
          : clip(h1, 47);

  const countText = productCount > 0 ? `${countProducts(productCount)} у каталозі. ` : "";
  const description = clip(
    `${h1} у Poli Valko: ${countText}Офіційна продукція ${brandName}, доставка Новою поштою по Україні та самовивіз у Бучі (ТК «Варшавський»).`,
    155,
  );

  return { title: rawTitle, description, h1 };
}
