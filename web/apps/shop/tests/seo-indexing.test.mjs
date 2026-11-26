import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const aliases = { "@/": `${resolve(here, "../src")}/`, "@polivalko/shared/": `${resolve(here, "../../../packages/shared")}/` };

// Loads a storefront module together with its real imports (path aliases included); type-only imports vanish on transpile.
function loadTs(file, seen = new Map()) {
  if (seen.has(file)) return seen.get(file).exports;
  const loaded = { exports: {} };
  seen.set(file, loaded);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const require = (name) => {
    const alias = Object.keys(aliases).find((prefix) => name.startsWith(prefix));
    const base = alias ? aliases[alias] + name.slice(alias.length) : name.startsWith(".") ? resolve(dirname(file), name) : null;
    if (!base) throw new Error(`Unexpected runtime import "${name}" in ${file}`);
    return loadTs(`${base}.ts`, seen);
  };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, require);
  return loaded.exports;
}

const src = (path) => loadTs(resolve(here, "../src", path));
const money = (value) => ({ value, currency: "UAH" });
const photo = { url: "https://cdn.test/zerno.webp", alt: "Зерно від мишей Bross" };

// Priced, sold out, no photo: one of the pages the sitemap leaves out.
const thinProduct = {
  id: "6f1c1f0e-7232-4a55-9f0e-000000007232",
  slug: "zerno-vid-myshei-bross-300-h-7232",
  sku: "7232",
  name: "Зерно від мишей Bross 300 г",
  brand: "Bross",
  descriptionHtml: null,
  price: money("130.00"),
  oldPrice: null,
  inStock: false,
  category: { id: "0a000000-0000-4000-8000-000000000109", slug: "shkidnyky", name: "Шкідники" },
  images: [],
  attributes: [],
  variants: [],
  seoTitle: "Зерно від мишей Bross 300 г, ціна 130 грн",
  seoDescription: "Зерно від мишей Bross 300 г у магазині Poli Valko.",
  labels: [],
};

test("an indexable page leaves robots to the root layout, so the preview directives set there reach the page", () => {
  const { seoMetadata } = src("features/seo/lib/metadata.ts");

  const page = seoMetadata({ title: "Добрива", description: "Добрива для саду й городу", path: "/catalog/dobryva" });

  assert.equal(Object.hasOwn(page, "robots"), false);
});

test("a noindex page still lets robots follow its links", () => {
  const { seoMetadata } = src("features/seo/lib/metadata.ts");

  const page = seoMetadata({ title: "Добрива", path: "/catalog/dobryva", noIndex: true });

  assert.deepEqual(page.robots, { index: false, follow: true });
});

test("a priced product page with a photo is indexable, in stock or sold out", () => {
  const { isIndexableProduct } = src("features/product/lib/indexable.ts");

  assert.equal(isIndexableProduct({ ...thinProduct, inStock: true, images: [photo] }), true);
  assert.equal(isIndexableProduct({ ...thinProduct, images: [photo] }), true);
});

test("a product without a photo is not offered to search engines, even when it is in stock", () => {
  const { isIndexableProduct } = src("features/product/lib/indexable.ts");

  assert.equal(isIndexableProduct({ ...thinProduct, inStock: true }), false);
  assert.equal(isIndexableProduct(thinProduct), false);
});

test("a product with a photo is offered to search engines even while it has no price", () => {
  const { isIndexableProduct } = src("features/product/lib/indexable.ts");
  const { productSeo } = src("features/product/lib/product-seo.ts");
  const priceOnRequest = { ...thinProduct, price: money("0.00"), images: [photo] };

  assert.equal(isIndexableProduct(priceOnRequest), true);
  assert.equal(productSeo(priceOnRequest).noIndex, false);
});

test("a product without a photo stays out of search even with a price of zero", () => {
  const { isIndexableProduct } = src("features/product/lib/indexable.ts");

  assert.equal(isIndexableProduct({ ...thinProduct, price: money("0.00") }), false);
});

test("a product page without a photo asks search engines not to index it, in stock or sold out", () => {
  const { productSeo } = src("features/product/lib/product-seo.ts");

  assert.equal(productSeo(thinProduct).noIndex, true);
  assert.equal(productSeo({ ...thinProduct, inStock: true }).noIndex, true);
});

test("a sitemap page carries a change date only when the real one is known", () => {
  const { staticSitemapEntries } = src("features/seo/lib/sitemap-entries.ts");

  const entries = staticSitemapEntries("https://shop.test", ["", "/services", "/returns", "/contacts"], {
    "/services": "2026-11-26T13:35:22.586198+00:00",
    "/returns": null,
  });

  assert.deepEqual(entries, [
    { url: "https://shop.test", changeFrequency: "weekly", priority: 1 },
    { url: "https://shop.test/services", lastModified: "2026-11-26T13:35:22.586198+00:00", changeFrequency: "weekly", priority: 0.5 },
    { url: "https://shop.test/returns", changeFrequency: "weekly", priority: 0.5 },
    { url: "https://shop.test/contacts", changeFrequency: "weekly", priority: 0.5 },
  ]);
});

test("the latest change is picked by the moment in time, whatever the time zone it is written in", () => {
  const { latestChange } = src("features/seo/lib/sitemap-entries.ts");

  // 15:00 at +02:00 is 13:00 UTC, which is earlier than 13:30 UTC.
  assert.equal(latestChange(["2026-11-26T15:00:00+02:00", null, "2026-11-26T13:30:00+00:00", undefined]), "2026-11-26T13:30:00+00:00");
  assert.equal(latestChange(["2026-11-20T10:00:00+00:00"]), "2026-11-20T10:00:00+00:00");
  assert.equal(latestChange([null, undefined]), undefined);
  assert.equal(latestChange([]), undefined);
});

test("a product page with photos stays indexable and previews its first four photos", () => {
  const { productSeo } = src("features/product/lib/product-seo.ts");
  const urls = ["a", "b", "c", "d", "e"].map((name) => `https://cdn.test/${name}.webp`);

  const page = productSeo({ ...thinProduct, inStock: true, images: urls.map((url) => ({ url, alt: "" })) });

  assert.equal(page.noIndex, false);
  assert.equal(page.path, "/product/zerno-vid-myshei-bross-300-h-7232");
  assert.equal(page.title, "Зерно від мишей Bross 300 г, ціна 130 грн");
  assert.equal(page.description, "Зерно від мишей Bross 300 г у магазині Poli Valko.");
  assert.deepEqual(page.images, ["https://cdn.test/a.webp", "https://cdn.test/b.webp", "https://cdn.test/c.webp", "https://cdn.test/d.webp"]);
});

test("the sale page counts as empty only when the catalog answered with no sale products", () => {
  const { saleIsEmpty } = src("features/catalog/lib/sale.ts");

  assert.equal(saleIsEmpty(0), true);
  assert.equal(saleIsEmpty(3), false);
  // The catalog did not answer: indexing stays as it was.
  assert.equal(saleIsEmpty(null), false);
});

// One token per pager cell: the page number, "*" for the current page, "w" for cells shown on wide screens only;
// "…" is a gap shown everywhere, "…w" on wide screens only, "…n" on narrow screens only.
function pagerTokens(page, totalPages) {
  const { pagerCells } = src("features/catalog/lib/pager-cells.ts");
  return pagerCells(page, totalPages)
    .map((cell) => (cell.kind === "gap" ? `…${cell.show === "all" ? "" : cell.show[0]}` : `${cell.page}${cell.current ? "*" : ""}${cell.show === "wide" ? "w" : ""}`))
    .join(" ");
}

test("a phone keeps the compact pager: first, last and the current page with its neighbours", () => {
  const narrow = (tokens) => tokens.split(" ").filter((token) => !token.endsWith("w")).map((token) => token.replace("…n", "…")).join(" ");

  assert.equal(narrow(pagerTokens(1, 70)), "1* 2 … 70");
  assert.equal(narrow(pagerTokens(36, 70)), "1 … 35 36* 37 … 70");
  assert.equal(narrow(pagerTokens(4, 7)), "1 … 3 4* 5 … 7");
  assert.equal(narrow(pagerTokens(70, 70)), "1 … 69 70*");
});

test("a wide screen adds two more neighbours and a round-numbered jump halfway to each end", () => {
  assert.equal(pagerTokens(1, 70), "1* 2 3w … 40w …w 70");
  assert.equal(pagerTokens(36, 70), "1 … 20w …w 34w 35 36* 37 38w … 55w …w 70");
  assert.equal(pagerTokens(1, 206), "1* 2 3w … 100w …w 206");
});

test("a short listing shows every page, and a gap of a few pages gets no jump", () => {
  assert.equal(pagerTokens(3, 5), "1 2 3* 4 5");
  assert.equal(pagerTokens(4, 7), "1 2w …n 3 4* 5 6w …n 7");
  assert.equal(pagerTokens(1, 10), "1* 2 3w … 10");
  assert.equal(pagerTokens(2, 2), "1 2*");
});

test("from the first page of the largest listings every page is a few clicks away", () => {
  const { pagerCells } = src("features/catalog/lib/pager-cells.ts");
  const clicksToFarthestPage = (totalPages) => {
    const depth = new Map([[1, 0]]);
    for (const queue = [1]; queue.length > 0; ) {
      const page = queue.shift();
      for (const cell of pagerCells(page, totalPages)) {
        if (cell.kind !== "page" || depth.has(cell.page)) continue;
        depth.set(cell.page, depth.get(page) + 1);
        queue.push(cell.page);
      }
    }
    assert.equal(depth.size, totalPages);
    return Math.max(...depth.values());
  };

  // The compact pager needed 35 clicks for «Насіння» (70 pages) and 103 for the whole catalog (206 pages).
  assert.ok(clicksToFarthestPage(70) <= 5, `70 pages: ${clicksToFarthestPage(70)} clicks`);
  assert.ok(clicksToFarthestPage(206) <= 7, `206 pages: ${clicksToFarthestPage(206)} clicks`);
});

test("the platform's own address of the shop redirects for good to the shop's domain, path kept", () => {
  const { duplicateHostRedirects } = src("shared/lib/duplicate-hosts.ts");

  // The host is matched as a pattern, so its dots are escaped.
  assert.deepEqual(duplicateHostRedirects("https://www.poli-valko.com/"), [
    { source: "/:path*", has: [{ type: "host", value: String.raw`polivalko\.vercel\.app` }], destination: "https://www.poli-valko.com/:path*", permanent: true },
  ]);
});

test("no host redirect without a site address, and never from the shop's own host to itself", () => {
  const { duplicateHostRedirects } = src("shared/lib/duplicate-hosts.ts");

  assert.deepEqual(duplicateHostRedirects(undefined), []);
  assert.deepEqual(duplicateHostRedirects("  "), []);
  assert.deepEqual(duplicateHostRedirects("https://polivalko.vercel.app"), []);
});
