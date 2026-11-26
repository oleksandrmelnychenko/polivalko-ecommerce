import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const aliases = {
  "@/": `${resolve(here, "../src")}/`,
  "@polivalko/shared/": `${resolve(here, "../../../packages/shared")}/`,
};

function loadTs(file, seen = new Map()) {
  if (seen.has(file)) return seen.get(file).exports;
  const loaded = { exports: {} };
  seen.set(file, loaded);
  const js = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = (name) => {
    const alias = Object.keys(aliases).find((prefix) => name.startsWith(prefix));
    const base = alias
      ? aliases[alias] + name.slice(alias.length)
      : name.startsWith(".")
        ? resolve(dirname(file), name)
        : null;
    if (!base) throw new Error(`Unexpected runtime import "${name}" in ${file}`);
    return loadTs(`${base}.ts`, seen);
  };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, require);
  return loaded.exports;
}

const src = resolve(here, "../src");
const {
  CATEGORY_BRAND_PRIORITY_MATRIX,
  categoryBrandHref,
  categoryBrandSeoMeta,
  duplicateSubcategoryRedirect,
  resolveCatalogRobotsAndCanonical,
} = loadTs(`${src}/features/catalog/lib/category-brand-seo.ts`);
const { articles } = loadTs(`${src}/features/journal/articles.ts`);
const { JOURNAL_ENABLED } = loadTs(`${src}/features/journal/config.ts`);

test("clean Category × Brand route with sufficient products is indexable and sitemap-eligible", () => {
  const decision = resolveCatalogRobotsAndCanonical({
    routeType: "category_brand",
    categorySlug: "vse-dlia-polyvu",
    brandSlug: "irritec",
    searchParams: {},
    totalProducts: 24,
  });

  assert.equal(decision.index, true);
  assert.equal(decision.follow, true);
  assert.equal(decision.canonicalPath, "/catalog/vse-dlia-polyvu/irritec");
  assert.equal(decision.inSitemap, true);
  assert.equal(decision.redirectTo, null);
  assert.equal(decision.reason, "clean_indexable");
});

test("duplicate subcategory brands (pidzemnyi-polyv + hunter/irritec) redirect to existing L3 subcategory", () => {
  assert.equal(duplicateSubcategoryRedirect("pidzemnyi-polyv", "hunter"), "/catalog/hunter");
  assert.equal(duplicateSubcategoryRedirect("pidzemnyi-polyv", "irritec"), "/catalog/irritec");
  assert.equal(duplicateSubcategoryRedirect("hunter", "hunter"), "/catalog/hunter");
  assert.equal(categoryBrandHref("pidzemnyi-polyv", "hunter"), "/catalog/hunter");
  assert.equal(categoryBrandHref("krapelnyi-polyv", "irritec"), "/catalog/krapelnyi-polyv/irritec");

  const decision = resolveCatalogRobotsAndCanonical({
    routeType: "category_brand",
    categorySlug: "pidzemnyi-polyv",
    brandSlug: "hunter",
    searchParams: {},
    totalProducts: 68,
  });

  assert.equal(decision.index, false);
  assert.equal(decision.inSitemap, false);
  assert.equal(decision.redirectTo, "/catalog/hunter");
  assert.equal(decision.canonicalPath, "/catalog/hunter");
});

test("Category × Brand with <3 products is noindex, follow and canonicalized to parent category", () => {
  const decision = resolveCatalogRobotsAndCanonical({
    routeType: "category_brand",
    categorySlug: "shlanhy",
    brandSlug: "cellfast",
    searchParams: {},
    totalProducts: 2,
  });

  assert.equal(decision.index, false);
  assert.equal(decision.follow, true);
  assert.equal(decision.canonicalPath, "/catalog/shlanhy");
  assert.equal(decision.inSitemap, false);
  assert.equal(decision.reason, "noindex_below_product_threshold");
});

test("multi-filter combinations on category or Category × Brand are strictly noindex, follow canonicalized to base", () => {
  const cases = [
    { brand: "irritec", priceMin: "500" },
    { brand: "irritec,cellfast" },
    { brand: ["irritec", "cellfast"] },
    { inStock: "true" },
    { onSale: "true" },
    { f: "diametr:16mm" },
    { sort: "price_asc" },
    { pageSize: "96" },
    { unknownTrap: "1" },
    { priceMax: "1000", page: "2" },
  ];

  for (const searchParams of cases) {
    const decision = resolveCatalogRobotsAndCanonical({
      routeType: "category_brand",
      categorySlug: "krapelnyi-polyv",
      brandSlug: "irritec",
      searchParams,
      totalProducts: 15,
    });
    assert.equal(decision.index, false, `Expected noindex for ${JSON.stringify(searchParams)}`);
    assert.equal(decision.follow, true);
    assert.equal(decision.canonicalPath, "/catalog/krapelnyi-polyv/irritec");
    assert.equal(decision.inSitemap, false);
  }
});

test("tracking parameters (utm_*, fbclid, gclid) do not cause accidental noindex and are stripped from canonical", () => {
  const decision = resolveCatalogRobotsAndCanonical({
    routeType: "category_brand",
    categorySlug: "shlanhy",
    brandSlug: "cellfast",
    searchParams: { utm_source: "google", utm_campaign: "spring", gclid: "test123", fbclid: "fb999" },
    totalProducts: 18,
  });

  assert.equal(decision.index, true);
  assert.equal(decision.canonicalPath, "/catalog/shlanhy/cellfast");
  assert.equal(decision.inSitemap, true);
});

test("clean pagination (?page=2) is indexable with paginated canonical and excluded from XML sitemap", () => {
  const decision = resolveCatalogRobotsAndCanonical({
    routeType: "category_brand",
    categorySlug: "ruchnyi-instrument",
    brandSlug: "fiskars",
    searchParams: { page: "2" },
    totalProducts: 45,
  });

  assert.equal(decision.index, true);
  assert.equal(decision.canonicalPath, "/catalog/ruchnyi-instrument/fiskars?page=2");
  assert.equal(decision.inSitemap, false);
});

test("legacy single-brand query on priority category resolves to clean landing redirect, while non-priority stays noindex", () => {
  const priority = resolveCatalogRobotsAndCanonical({
    routeType: "category",
    categorySlug: "shlanhy",
    brandSlug: undefined,
    searchParams: { brand: "Cellfast" },
    totalProducts: 12,
  });
  assert.equal(priority.redirectTo, "/catalog/shlanhy/cellfast");
  assert.equal(priority.canonicalPath, "/catalog/shlanhy/cellfast");

  const nonPriority = resolveCatalogRobotsAndCanonical({
    routeType: "category",
    categorySlug: "shlanhy",
    searchParams: { brand: "unlisted-brand" },
    totalProducts: 12,
  });
  assert.equal(nonPriority.redirectTo, null);
  assert.equal(nonPriority.index, false);
  assert.equal(nonPriority.canonicalPath, "/catalog/shlanhy");
});

test("priority Category × Brand matrix has zero duplicate subcategory conflicts and clean metadata lengths", () => {
  const seen = new Set();
  for (const entry of CATEGORY_BRAND_PRIORITY_MATRIX) {
    const key = `${entry.categorySlug}::${entry.brandSlug}`;
    assert.equal(seen.has(key), false, `Duplicate matrix entry ${key}`);
    seen.add(key);
    assert.equal(
      duplicateSubcategoryRedirect(entry.categorySlug, entry.brandSlug),
      null,
      `Matrix entry ${key} duplicates an existing L3 subcategory`,
    );

    const meta = categoryBrandSeoMeta({
      categoryName: entry.categoryName,
      brandName: entry.brandName,
      productCount: 15,
    });
    const renderedTitleLen = `${meta.title} | Poli Valko`.length;
    assert.ok(renderedTitleLen <= 65, `Title too long (${renderedTitleLen}): ${meta.title}`);
    assert.ok(meta.description.length >= 115 && meta.description.length <= 160, `Bad desc len (${meta.description.length}): ${meta.description}`);
  }
});

test("blog/journal articles are enabled, use zero Unsplash URLs, have valid SEO lengths, and link to real routes", () => {
  assert.equal(JOURNAL_ENABLED, true);
  assert.ok(articles.length >= 7);

  const slugs = new Set();
  const titles = new Set();
  const descs = new Set();

  for (const article of articles) {
    assert.equal(slugs.has(article.slug), false, `Duplicate blog slug: ${article.slug}`);
    slugs.add(article.slug);

    assert.equal(titles.has(article.seoTitle), false, `Duplicate blog seoTitle: ${article.seoTitle}`);
    titles.add(article.seoTitle);

    assert.equal(descs.has(article.seoDescription), false, `Duplicate blog seoDescription: ${article.seoDescription}`);
    descs.add(article.seoDescription);

    const fullTitleLen = `${article.seoTitle} | Poli Valko`.length;
    assert.ok(fullTitleLen >= 45 && fullTitleLen <= 60, `Blog title out of 45-60 range (${fullTitleLen}): ${article.seoTitle} | Poli Valko`);
    assert.ok(
      article.seoDescription.length >= 130 && article.seoDescription.length <= 155,
      `Blog description out of 130-155 range (${article.seoDescription.length}): ${article.seoDescription}`,
    );

    assert.ok(article.image.url.startsWith("/brand/"), `Article image must be local /brand/* asset: ${article.image.url}`);
    assert.equal(article.image.url.includes("unsplash"), false);
    assert.ok(article.image.alt.trim().length >= 15, `Article image alt too short: ${article.slug}`);
    assert.ok(article.relatedCategories.length >= 2, `Article needs internal catalog links: ${article.slug}`);
  }
});
