import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadShop as src } from "./helpers/load-ts.mjs";

const here = dirname(fileURLToPath(import.meta.url));
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

test("homepage metadata preserves trailing slash on canonical and og:url by bypassing metadataBase origin stripping", () => {
  const prev = process.env.SITE_URL;
  process.env.SITE_URL = "https://www.poli-valko.com";
  try {
    const { seoMetadata } = src("features/seo/lib/metadata.ts");
    const home = seoMetadata({
      title: "Poli Valko — все для поливу, саду й городу в Україні",
      description: "Опис головної сторінки",
      path: "/",
      exactTitle: true,
    });
    assert.equal(home.metadataBase, null);
    assert.equal(home.alternates.canonical, "https://www.poli-valko.com/");
    assert.equal(home.openGraph.url, "https://www.poli-valko.com/");
    assert.equal(home.openGraph.images[0].url, "https://www.poli-valko.com/brand/poli-valko-social.png");
  } finally {
    if (prev === undefined) delete process.env.SITE_URL;
    else process.env.SITE_URL = prev;
  }
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
    { url: "https://shop.test/", changeFrequency: "weekly", priority: 1 },
    { url: "https://shop.test/services", lastModified: "2026-11-26T13:35:22.586198+00:00", changeFrequency: "weekly", priority: 0.5 },
    { url: "https://shop.test/returns", changeFrequency: "weekly", priority: 0.5 },
    { url: "https://shop.test/contacts", changeFrequency: "weekly", priority: 0.5 },
  ]);
});

test("sitemapXml and sitemapIndexXml serialize valid escaped XML documents", () => {
  const { sitemapIndexXml, sitemapXml } = src("features/seo/lib/sitemap-entries.ts");

  const index = sitemapIndexXml([
    { url: "https://shop.test/sitemap-pages.xml", lastModified: "2026-11-26T12:00:00+00:00" },
    { url: "https://shop.test/sitemap-products.xml" },
  ]);
  assert.match(index, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(index, /<sitemapindex xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(index, /<sitemap><loc>https:\/\/shop\.test\/sitemap-pages\.xml<\/loc><lastmod>2026-11-26T12:00:00\+00:00<\/lastmod><\/sitemap>/);
  assert.match(index, /<sitemap><loc>https:\/\/shop\.test\/sitemap-products\.xml<\/loc><\/sitemap>/);

  const urls = sitemapXml([
    { url: "https://shop.test/", lastModified: "2026-11-26T12:00:00+00:00", changeFrequency: "weekly", priority: 1 },
    { url: "https://shop.test/catalog?a=1&b=2", changeFrequency: "daily", priority: 0.8 },
  ]);
  assert.match(urls, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(urls, /<loc>https:\/\/shop\.test\/<\/loc><lastmod>2026-11-26T12:00:00\+00:00<\/lastmod><changefreq>weekly<\/changefreq><priority>1<\/priority>/);
  assert.match(urls, /<loc>https:\/\/shop\.test\/catalog\?a=1&amp;b=2<\/loc>/);
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

test("a long text is clipped at a word boundary and marked with an ellipsis", () => {
  const { clip } = src("features/product/lib/description.ts");

  assert.equal(clip("Шланг для поливу саду", 18), "Шланг для поливу…");
  assert.equal(clip("Шланг, який не перекручується", 8), "Шланг…");
  assert.equal(clip("Шланг", 18), "Шланг");
});

test("structured data describes the product with its own text in full, not the first 160 characters", () => {
  const { markupDescription } = src("features/product/lib/description.ts");
  const first = "Металевий імпульсний зрошувач на кілку для поливу великих газонів, городу й саду.";
  const second = "Сектор поливу налаштовується від двадцяти до трьохсот шістдесяти градусів, а радіус сягає дванадцяти метрів за нормального тиску води в системі.";

  const description = markupDescription({ descriptionHtml: `<p>${first}</p><p>${second}</p>`, seoDescription: "Шаблон магазину" });

  assert.equal(description, `${first} ${second}`);
  assert.ok(description.length > 160);
});

test("without its own text the product markup falls back to the SEO description, or leaves the field out", () => {
  const { markupDescription } = src("features/product/lib/description.ts");

  assert.equal(markupDescription({ descriptionHtml: null, seoDescription: " Зрошувач у магазині " }), "Зрошувач у магазині");
  assert.equal(markupDescription({ descriptionHtml: "", seoDescription: null }), undefined);
});

test("the kind of a product is the first real word of its name, past any leading code", () => {
  const { typeWord } = src("features/product/lib/related.ts");

  assert.equal(typeWord("Томат Балконне Диво SeedEra, 0,1 г"), "Томат");
  assert.equal(typeWord("Контролер поливу Hunter X-Core XC-401-E, 4 зони"), "Контролер");
  assert.equal(typeWord("1101 Зерно від мишей і пацюків Bross 300гр"), "Зерно");
  assert.equal(typeWord('8000 "Лінивка з ручкою хром (36 шт)'), "Лінивка");
  assert.equal(typeWord("5101"), null);
  assert.equal(typeWord(""), null);
});

test("related products are the same kind first, then the rest of the category, without the product itself or repeats", () => {
  const { relatedItems } = src("features/product/lib/related.ts");
  const product = (id) => ({ id });
  const sameKind = ["current", "tomato-1", "tomato-2"].map(product);
  const sameCategory = ["tomato-1", "parsley", "current", "pepper", "carrot", "mustard"].map(product);

  assert.deepEqual(relatedItems(sameKind, sameCategory, "current").map((item) => item.id), ["tomato-1", "tomato-2", "parsley", "pepper", "carrot"]);
  assert.deepEqual(relatedItems([], sameCategory, "current", 2).map((item) => item.id), ["tomato-1", "parsley"]);
  assert.deepEqual(relatedItems([], [product("current")], "current"), []);
});

test("a product that cannot be bought tells the visitor what to ask the shop by phone", () => {
  const { askLine } = src("features/product/lib/ask.ts");

  assert.equal(askLine({ inStock: false, price: money("130.00") }), "Наявність і строк поставки уточніть телефоном");
  assert.equal(askLine({ inStock: false, price: money("0.00") }), "Ціну й наявність уточніть телефоном");
  assert.equal(askLine({ inStock: true, price: money("130.00") }), null);
});

test("a phone number as shown in the shop becomes a dialable link", () => {
  const { telHref } = src("features/product/lib/ask.ts");

  assert.equal(telHref("+38 (073) 818-52-22"), "tel:+380738185222");
});

test("a search that had to guess does not pass for products of the same kind", () => {
  const { sameKindItems } = src("features/product/lib/related.ts");
  const items = [{ id: "cucumber" }];

  assert.deepEqual(sameKindItems({ items, approximate: true }), []);
  assert.deepEqual(sameKindItems({ items, approximate: false }), items);
  assert.deepEqual(sameKindItems(null), []);
});

test("the shop's markup states the 14-day return window for Ukraine", () => {
  const { organizationJsonLd } = src("features/seo/lib/json-ld.ts");
  const { absoluteUrl, returnPolicyId } = src("features/seo/lib/site.ts");

  assert.deepEqual(organizationJsonLd({ contacts: null, seller: null, sameAs: [] }).hasMerchantReturnPolicy, {
    "@type": "MerchantReturnPolicy",
    "@id": returnPolicyId(),
    applicableCountry: "UA",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: 14,
    returnMethod: ["https://schema.org/ReturnByMail", "https://schema.org/ReturnInStore"],
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    merchantReturnLink: absoluteUrl("/returns"),
  });
});

test("brand icons meet Google favicon size rules (48px multiples) and Apple touch icon dimensions", () => {
  const pngDims = (file) => {
    const buf = readFileSync(resolve(here, "../src/app", file));
    assert.equal(buf.subarray(0, 8).toString("hex"), "89504e470d0a1a0a", `${file} must be a PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  };

  const icon = pngDims("icon.png");
  assert.equal(icon.width, icon.height);
  assert.equal(icon.width % 48, 0, "icon.png must be a multiple of 48px for Google Search");
  assert.ok(icon.width >= 96, `icon.png should be at least 96px, got ${icon.width}`);

  assert.deepEqual(pngDims("apple-icon.png"), { width: 180, height: 180 });

  const ico = readFileSync(resolve(here, "../src/app/favicon.ico"));
  assert.equal(ico.readUInt16LE(0), 0);
  assert.equal(ico.readUInt16LE(2), 1);
  const count = ico.readUInt16LE(4);
  assert.ok(count >= 1, "favicon.ico must contain at least one icon frame");
  const sizes = Array.from({ length: count }, (_, i) => ico[6 + i * 16] || 256);
  const maxSize = Math.max(...sizes);
  assert.equal(maxSize % 48, 0, `favicon.ico largest frame (${maxSize}px) must be a multiple of 48px`);
  assert.ok(sizes.includes(48), "favicon.ico must include a 48x48 frame");
});

test("secondary navigation dropdown panels carry data-nosnippet while top-level nav stays open to snippets and sitelinks", () => {
  const mainNav = readFileSync(resolve(here, "../src/features/layout/components/main-nav.tsx"), "utf8");
  const mobileMenu = readFileSync(resolve(here, "../src/features/layout/components/mobile-menu.tsx"), "utf8");

  assert.match(mainNav, /<nav className="site-nav"[^>]*>/);
  assert.doesNotMatch(mainNav, /<nav className="site-nav"[^>]*data-nosnippet/);
  assert.match(mainNav, /<div id="catalog-panel"[^>]*data-nosnippet/);
  assert.match(mainNav, /<div id="service-panel"[^>]*data-nosnippet/);
  assert.match(mobileMenu, /<div id="mobile-menu"[^>]*data-nosnippet/);
});

test("header utility bars, announcement bar, mobile dock, and footer legal/contacts carry data-nosnippet to keep Google snippets clean", () => {
  const layout = (file) => readFileSync(resolve(here, "../src/features/layout/components", file), "utf8");

  assert.match(layout("header-topbar.tsx"), /<div className="site-header__top"[^>]*data-nosnippet/);
  assert.match(layout("site-header.tsx"), /<div className="site-header__actions"[^>]*data-nosnippet/);
  assert.match(layout("announcement-bar.tsx"), /<aside className="announce"[^>]*data-nosnippet/);
  assert.match(layout("mobile-dock.tsx"), /<nav className="mobile-dock"[^>]*data-nosnippet/);
  const footer = layout("site-footer.tsx");
  assert.match(footer, /<div className="footer__about"[^>]*data-nosnippet/);
  assert.match(footer, /<div className="footer__legal"[^>]*data-nosnippet/);
});
