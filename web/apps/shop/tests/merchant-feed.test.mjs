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

const { merchantFeedXml } = loadTs(resolve(here, "../src/features/catalog/lib/merchant-feed.ts"));
const shop = { url: "https://shop.test", name: "Shop", description: "Garden goods" };
const money = (value) => ({ value, currency: "UAH" });

// A hose as the catalog holds it: branded, with a real barcode, a manufacturer model and two photos.
const hose = {
  id: "01a1fea5-0000-7000-8000-000000008326",
  slug: "polyvalnyi-shlanh-green-ats-1-2-50-m-8326",
  sku: "8326",
  name: "Поливальний шланг Green ATS, 50 м",
  brand: "Cellfast",
  descriptionHtml: "<p>Чотиришаровий шланг із захистом від перекручування.</p><p>Довжина бухти — 50 м.</p>",
  price: money("2499.00"),
  oldPrice: null,
  inStock: true,
  categoryPath: ["Все для поливу", "Шланги"],
  images: ["https://cdn.test/hose-1.webp", "https://cdn.test/hose-2.webp"],
  attributes: [
    { name: "Штрихкод", value: "5901828852411" },
    { name: "Модель виробника", value: "15-101" },
    { name: "Одиниця виміру", value: "шт" },
  ],
};

const one = (item) => merchantFeedXml([item], shop);
const count = (xml, tag) => xml.split(`<${tag}>`).length - 1;

test("a product goes into the feed with everything a shopping service asks for", () => {
  const xml = one(hose);

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes('<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">'));
  assert.ok(xml.includes("<g:id>8326</g:id>"));
  assert.ok(xml.includes("<title>Поливальний шланг Green ATS, 50 м</title>"));
  assert.ok(xml.includes("<description>Чотиришаровий шланг із захистом від перекручування. Довжина бухти — 50 м.</description>"));
  assert.ok(xml.includes("<link>https://shop.test/product/polyvalnyi-shlanh-green-ats-1-2-50-m-8326</link>"));
  assert.ok(xml.includes("<g:image_link>https://cdn.test/hose-1.webp</g:image_link>"));
  assert.ok(xml.includes("<g:additional_image_link>https://cdn.test/hose-2.webp</g:additional_image_link>"));
  assert.ok(xml.includes("<g:availability>in_stock</g:availability>"));
  assert.ok(xml.includes("<g:price>2499.00 UAH</g:price>"));
  assert.ok(xml.includes("<g:brand>Cellfast</g:brand>"));
  assert.ok(xml.includes("<g:gtin>5901828852411</g:gtin>"));
  assert.ok(xml.includes("<g:mpn>15-101</g:mpn>"));
  assert.ok(xml.includes("<g:product_type>Все для поливу &gt; Шланги</g:product_type>"));
  assert.ok(xml.includes("<g:condition>new</g:condition>"));
  assert.equal(count(xml, "g:sale_price"), 0);
  assert.equal(count(xml, "g:identifier_exists"), 0);
});

test("a sold-out product stays in the feed as out of stock", () => {
  assert.ok(one({ ...hose, inStock: false }).includes("<g:availability>out_of_stock</g:availability>"));
});

test("a discounted product shows the old price as the price and the current one as the sale price", () => {
  const xml = one({ ...hose, price: money("250.00"), oldPrice: money("300.00") });

  assert.ok(xml.includes("<g:price>300.00 UAH</g:price>"));
  assert.ok(xml.includes("<g:sale_price>250.00 UAH</g:sale_price>"));
});

test("an article number in the barcode field is not passed off as a GTIN", () => {
  const xml = one({ ...hose, attributes: [{ name: "Штрихкод", value: "12254" }] });

  assert.equal(count(xml, "g:gtin"), 0);
});

test("only a product with no brand, no GTIN and no model is declared to have no identifiers", () => {
  const unbranded = { ...hose, brand: null, attributes: [{ name: "Штрихкод", value: "12254" }] };

  assert.ok(one(unbranded).includes("<g:identifier_exists>no</g:identifier_exists>"));
  assert.equal(count(one(unbranded), "g:brand"), 0);
  // A brand means the maker may have assigned identifiers the catalog does not hold: no such claim then.
  assert.equal(count(one({ ...unbranded, brand: "Cellfast" }), "g:identifier_exists"), 0);
  assert.equal(count(one({ ...unbranded, attributes: [{ name: "Модель виробника", value: "15-101" }] }), "g:identifier_exists"), 0);
});

test("special characters in a name are escaped and a control character is dropped", () => {
  const xml = one({ ...hose, name: 'Шланг 1/2" & <муфта>\u0007' });

  assert.ok(xml.includes("<title>Шланг 1/2&quot; &amp; &lt;муфта&gt;</title>"));
});

test("a product without a description of its own is described by its name", () => {
  assert.ok(one({ ...hose, descriptionHtml: null }).includes("<description>Поливальний шланг Green ATS, 50 м</description>"));
  assert.ok(one({ ...hose, descriptionHtml: "<p> </p>" }).includes("<description>Поливальний шланг Green ATS, 50 м</description>"));
});

test("a very long description is cut to what the feed accepts", () => {
  const xml = one({ ...hose, descriptionHtml: `<p>${"слово ".repeat(1000)}</p>` });
  const description = xml.slice(xml.indexOf("<description>", xml.indexOf("<item>")) + "<description>".length, xml.indexOf("</description>", xml.indexOf("<item>")));

  assert.ok(description.length <= 5000);
  assert.ok(description.endsWith("…"));
});

test("a product with many photos gives the first one and ten more", () => {
  const xml = one({ ...hose, images: Array.from({ length: 14 }, (_, index) => `https://cdn.test/${index}.webp`) });

  assert.equal(count(xml, "g:image_link"), 1);
  assert.equal(count(xml, "g:additional_image_link"), 10);
  assert.ok(xml.includes("<g:additional_image_link>https://cdn.test/10.webp</g:additional_image_link>"));
  assert.ok(!xml.includes("https://cdn.test/11.webp"));
});

test("when an article number repeats, the older product keeps it whatever the order of the list", () => {
  const older = { ...hose, id: "01a1fea5-0000-7000-8000-000000000001", sku: "7000", slug: "older" };
  const newer = { ...hose, id: "01a1fea5-0000-7000-8000-000000000002", sku: "7000", slug: "newer" };
  const ids = (xml) => [...xml.matchAll(/<g:id>([^<]+)<\/g:id>/g)].map((match) => match[1]);

  assert.deepEqual(ids(merchantFeedXml([older, newer], shop)), ["7000", "01a1fea5-0000-7000-8000-000000000002"]);
  assert.deepEqual(ids(merchantFeedXml([newer, older], shop)), ["01a1fea5-0000-7000-8000-000000000002", "7000"]);
});

test("an empty list is an error, not an empty feed", () => {
  assert.throws(() => merchantFeedXml([], shop));
});
