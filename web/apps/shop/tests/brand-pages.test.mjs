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

const src = resolve(here, "../src");
const { brandHref } = loadTs(`${src}/features/product/lib/brand-href.ts`);
const { brandSeoDescription } = loadTs(`${src}/features/catalog/lib/brand-seo.ts`);
const { hrefFor, parseListingParams, toQuery } = loadTs(`${src}/features/catalog/lib/listing-params.ts`);

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
