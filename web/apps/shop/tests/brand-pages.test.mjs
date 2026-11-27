import assert from "node:assert/strict";
import { test } from "node:test";
import { loadShop } from "./helpers/load-ts.mjs";

const { brandHref } = loadShop("features/product/lib/brand-href.ts");
const { brandSeoDescription } = loadShop("features/catalog/lib/brand-seo.ts");
const { hrefFor, parseListingParams, toQuery } = loadShop("features/catalog/lib/listing-params.ts");

test("a product links to its brand page when the brand has one", () => {
  assert.equal(brandHref({ brand: "Hunter", brandSlug: "hunter" }), "/brands/hunter");
});

test("a product whose brand has no page keeps the catalog filter", () => {
  assert.equal(brandHref({ brand: "Spear & Jackson", brandSlug: null }), "/catalog?brand=Spear%20%26%20Jackson");
});

test("a brand page describes itself with its own first paragraph", () => {
  const description = "Hunter Industries робить зрошувачі й контролери для автополиву.\nДругий абзац.";
  assert.equal(brandSeoDescription({ name: "Hunter", description, productCount: 68 }), "Hunter Industries робить зрошувачі й контролери для автополиву.");
});

test("a brand page without a description says what the shop has of the brand", () => {
  const text = brandSeoDescription({ name: "Hunter", description: null, productCount: 68 });
  assert.match(text, /^Hunter у Poli Valko: 68 товарів/);
  assert.ok(text.length <= 160);
});

test("a brand page keeps its brand when a shopper filters the listing", () => {
  const parsed = parseListingParams({ inStock: "true", page: "2" }, "/brands/hunter");
  const query = toQuery({ brandPage: "hunter" }, parsed);
  assert.equal(query.brandPage, "hunter");
  assert.equal(query.inStock, true);
  assert.equal(hrefFor("/brands/hunter", {}, parsed, { page: 3 }), "/brands/hunter?inStock=true&page=3");
});
