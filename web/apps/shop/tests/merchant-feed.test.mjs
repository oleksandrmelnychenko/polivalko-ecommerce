import assert from "node:assert/strict";
import { test } from "node:test";
import { loadShop } from "./helpers/load-ts.mjs";

const { isMerchantFeedEligible, merchantFeedXml } = loadShop("features/catalog/lib/merchant-feed.ts");
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
  assert.ok(xml.includes("<g:google_product_category>Home &amp; Garden &gt; Lawn &amp; Garden &gt; Watering &amp; Irrigation &gt; Garden Hoses</g:google_product_category>"));
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

test("smoking tobacco items are excluded from the Merchant Center feed while garden tobacco dust stays eligible", () => {
  const tobaccoSeeds = {
    ...hose,
    id: "01a1fea5-0000-7000-8000-000000010546",
    sku: "10546",
    slug: "tiutiun-kurylnyi-havana-seedera-0-05-h-10546",
    name: "Тютюн Курильний Гавана SeedEra, 0,05 г",
    categoryPath: ["Все для рослин", "Насіння"],
  };
  const tobaccoDust = {
    ...hose,
    id: "01a1fea5-0000-7000-8000-000000011944",
    sku: "11944",
    slug: "tiutiunovyi-pyl-11944",
    name: "Тютюновий пил.",
    categoryPath: ["Все для рослин", "Засоби захисту рослин"],
  };

  assert.equal(isMerchantFeedEligible(tobaccoSeeds), false);
  assert.equal(isMerchantFeedEligible(tobaccoDust), true);

  const xml = merchantFeedXml([hose, tobaccoSeeds, tobaccoDust], shop);
  assert.ok(xml.includes("<g:id>8326</g:id>"));
  assert.ok(!xml.includes("<g:id>10546</g:id>"));
  assert.ok(xml.includes("<g:id>11944</g:id>"));
  assert.ok(xml.includes("<g:google_product_category>Home &amp; Garden &gt; Lawn &amp; Garden &gt; Gardening &gt; Disease Control</g:google_product_category>"));
});

test("missing brand is recovered from attributes, descriptions, aliases, and unambiguous GS1 prefixes without collisions", () => {
  const knownValagro = {
    ...hose,
    id: "01a1fea5-0000-7000-8000-000000000010",
    sku: "10",
    slug: "valagro-ref",
    brand: "Valagro",
    name: "Добриво Valagro Master",
    attributes: [{ name: "Штрихкод", value: "4820146160064" }],
  };
  const fromTitle = { ...hose, id: "01a1fea5-0000-7000-8000-000000000011", sku: "11", slug: "valagro-kendal", brand: null, name: "Біостимулятор Valagro Kendal, 25 мл", descriptionHtml: null, attributes: [] };
  const fromAttr = { ...hose, id: "01a1fea5-0000-7000-8000-000000000012", sku: "12", slug: "attr-brand", brand: null, name: "Фільтр дисковий 1\"", descriptionHtml: null, attributes: [{ name: "Виробник", value: "Irritec" }] };
  const trulyGeneric = { ...hose, id: "01a1fea5-0000-7000-8000-000000000013", sku: "13", slug: "generic-item", brand: null, name: "Агроперліт 1 л", descriptionHtml: "<p>Купити в магазині Poli-Valko.</p>", attributes: [] };
  const fromDescAlias = { ...hose, id: "01a1fea5-0000-7000-8000-000000000014", sku: "14", slug: "rehau-hose", brand: null, name: "Шланг Есо (1/2) 20 м", descriptionHtml: "<p>Садовий шланг REHAU ECO Line.</p>", attributes: [{ name: "Штрихкод", value: "4007360588878" }] };
  const fromGtinIntl = { ...hose, id: "01a1fea5-0000-7000-8000-000000000015", sku: "15", slug: "rehau-part", brand: null, name: "Перехідник 3/4", descriptionHtml: "<p>Пластиковий перехідник.</p>", attributes: [{ name: "Штрихкод", value: "4007360191214" }] };
  const fromGtinUa9 = { ...hose, id: "01a1fea5-0000-7000-8000-000000000016", sku: "16", slug: "valagro-viva", brand: null, name: "Віва 25 г", descriptionHtml: null, attributes: [{ name: "Штрихкод", value: "4820146160095" }] };
  // Different 9-digit Ukrainian company prefix (482014668 vs 482014616) must NOT inherit Valagro.
  const distinctUaCompany = { ...hose, id: "01a1fea5-0000-7000-8000-000000000017", sku: "17", slug: "coco-brick", brand: null, name: "Кокосовий брикет 0.5 кг", descriptionHtml: null, attributes: [{ name: "Штрихкод", value: "4820146680012" }] };
  // Product-line alias (YaraMila -> Yara) must NOT propagate across Ukrainian repacker 482 barcodes.
  const yaraLine = { ...hose, id: "01a1fea5-0000-7000-8000-000000000018", sku: "18", slug: "yaramila", brand: null, name: "Добриво ЯраМіла Кропкер 2,5 кг", descriptionHtml: null, attributes: [{ name: "Штрихкод", value: "4820269250055" }] };
  const sameRepackerOther = { ...hose, id: "01a1fea5-0000-7000-8000-000000000019", sku: "19", slug: "special-fert", brand: null, name: "Особливе добриво 50 г", descriptionHtml: null, attributes: [{ name: "Штрихкод", value: "4820269250086" }] };
  // Colliding GS1 prefix shared by two brands must never propagate.
  const collideA = { ...hose, id: "01a1fea5-0000-7000-8000-000000000020", sku: "20", slug: "col-a", brand: "Kvitofor", name: "Добриво Kvitofor", attributes: [{ name: "Штрихкод", value: "4820179190011" }] };
  const collideB = { ...hose, id: "01a1fea5-0000-7000-8000-000000000021", sku: "21", slug: "col-b", brand: "Чистий Лист", name: "Добриво Чистий Лист", attributes: [{ name: "Штрихкод", value: "4820179190028" }] };
  const collideTarget = { ...hose, id: "01a1fea5-0000-7000-8000-000000000022", sku: "22", slug: "col-target", brand: null, name: "Палички для квітів", descriptionHtml: null, attributes: [{ name: "Штрихкод", value: "4820179190035" }] };
  const housePacked = { ...hose, id: "01a1fea5-0000-7000-8000-000000000023", sku: "23", slug: "copper", brand: null, name: "Мідний купорос (Poli-Valko)", descriptionHtml: null, attributes: [] };

  const xml = merchantFeedXml(
    [knownValagro, fromTitle, fromAttr, trulyGeneric, fromDescAlias, fromGtinIntl, fromGtinUa9, distinctUaCompany, yaraLine, sameRepackerOther, collideA, collideB, collideTarget, housePacked],
    shop,
  );
  const items = Object.fromEntries(
    [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => [m[1].match(/<g:id>([^<]+)<\/g:id>/)[1], m[1]])
  );

  assert.ok(items["11"].includes("<g:brand>Valagro</g:brand>"));
  assert.ok(!items["11"].includes("<g:identifier_exists>no</g:identifier_exists>"));
  assert.ok(items["12"].includes("<g:brand>Irritec</g:brand>"));
  assert.ok(!items["13"].includes("<g:brand>"));
  assert.ok(items["13"].includes("<g:identifier_exists>no</g:identifier_exists>"));
  assert.ok(items["14"].includes("<g:brand>REHAU</g:brand>"));
  assert.ok(items["15"].includes("<g:brand>REHAU</g:brand>"));
  assert.ok(items["16"].includes("<g:brand>Valagro</g:brand>"));
  assert.ok(!items["17"].includes("<g:brand>"));
  assert.ok(items["18"].includes("<g:brand>Yara</g:brand>"));
  assert.ok(!items["19"].includes("<g:brand>"));
  assert.ok(!items["22"].includes("<g:brand>"));
  assert.ok(items["23"].includes("<g:brand>Poli Valko</g:brand>"));
});
