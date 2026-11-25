import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";
import { canBuy, hasPrice, PRICE_ON_REQUEST } from "../src/shared/lib/price.ts";
import { comparisonRows } from "../src/features/compare/model.ts";

function load(path, require) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, require);
  return loaded.exports;
}

const money = (value) => ({ value, currency: "UAH" });

test("a product without a retail price is never buyable, whatever the stock says", () => {
  assert.equal(PRICE_ON_REQUEST, "Ціну уточнюйте");
  assert.equal(hasPrice(money("0.00")), false);
  assert.equal(hasPrice(money("0")), false);
  assert.equal(hasPrice(money("0.01")), true);
  assert.equal(canBuy({ inStock: true, price: money("0.00") }), false);
  assert.equal(canBuy({ inStock: false, price: money("100.00") }), false);
  assert.equal(canBuy({ inStock: true, price: money("100.00") }), true);
});

test("comparison shows «Ціну уточнюйте» instead of 0 and does not claim availability", () => {
  const base = { id: "a", slug: "a", name: "a", sku: "a", category: { slug: "c", name: "c" }, attributes: [] };
  const rows = comparisonRows([{ ...base, price: money("0.00"), inStock: true }, { ...base, id: "b", price: money("250.00"), inStock: true }]);
  assert.deepEqual(rows.find((row) => row.key === "price").values, ["Ціну уточнюйте", "250"]);
  assert.deepEqual(rows.find((row) => row.key === "availability").values, ["Немає в наявності", "В наявності"]);
});

test("product structured data has no Offer when the price is 0", () => {
  const price = load("../src/shared/lib/price.ts", () => ({}));
  const seo = { absoluteUrl: (path) => `https://shop.test${path}`, organizationId: () => "https://shop.test/#organization", SITE_NAME: "Shop" };
  const gtin = load("../../../packages/shared/lib/gtin.ts", () => ({}));
  const { productJsonLd } = load("../src/features/product/lib/json-ld.ts", (name) =>
    name === "@/features/seo" ? seo : name === "@/shared/lib/price" ? price : name === "@polivalko/shared/lib/gtin" ? gtin : { descriptionText: () => "" });
  const product = {
    slug: "yalynka", name: "Ялинка", sku: "12254", seoDescription: null, descriptionHtml: null, images: [], brand: null, attributes: [],
    category: { name: "Новий рік" }, inStock: false, price: money("0.00"),
  };

  assert.equal(productJsonLd(product).offers, undefined);
  const priced = productJsonLd({ ...product, inStock: true, price: money("2500.00") }).offers;
  assert.equal(priced.price, "2500.00");
  assert.equal(priced.availability, "https://schema.org/InStock");

  const withBarcode = productJsonLd({ ...product, attributes: [{ name: "Штрихкод", value: "4823067702320" }] });
  assert.equal(withBarcode.gtin13, "4823067702320");
  assert.equal(productJsonLd({ ...product, attributes: [{ name: "Штрихкод", value: "12254" }] }).gtin13, undefined);
});
