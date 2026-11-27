import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { loadShop as src, shopSrc } from "./helpers/load-ts.mjs";
const BRAND_SUFFIX = " | Poli Valko";
const renderTitle = (rawTitle, exactTitle = false) =>
  exactTitle || /poli\s*valko[\s.!?»"')]*$/i.test(rawTitle.trim())
    ? rawTitle.trim()
    : `${rawTitle.trim()}${BRAND_SUFFIX}`;

/** Extracts static string literals (or top-level string consts) from seoMetadata({ title, description, exactTitle? }). */
function extractStaticSeoMeta(relPath) {
  const code = readFileSync(resolve(shopSrc, relPath), "utf8");
  const resolveConst = (field) => {
    const inline = code.match(new RegExp(`${field}:\\s*(?:paged\\s*\\?[\\s\\S]*?:\\s*)?"([^"]+)"`));
    if (inline) return inline[1];
    const ref = code.match(new RegExp(`${field}:\\s*([A-Z0-9_]+)\\b`));
    if (ref) {
      const def = code.match(new RegExp(`const\\s+${ref[1]}\\s*=\\s*"([^"]+)"`));
      if (def) return def[1];
    }
    return null;
  };
  const rawTitle = resolveConst("title");
  const description = resolveConst("description");
  const exactTitle = /exactTitle:\s*true/.test(code);
  assert.ok(rawTitle, `Could not find static title in ${relPath}`);
  assert.ok(description, `Could not find static description in ${relPath}`);
  return {
    relPath,
    rawTitle,
    renderedTitle: renderTitle(rawTitle, exactTitle),
    description,
    exactTitle,
  };
}

test("all core storefront pages have strictly 45–60 char rendered titles, 130–155 char descriptions, and zero duplicates", () => {
  const routes = [
    "app/(shop)/page.tsx",
    "app/(shop)/catalog/page.tsx",
    "app/(shop)/brands/page.tsx",
    "app/(shop)/sale/page.tsx",
    "app/(shop)/contacts/page.tsx",
    "app/(shop)/services/page.tsx",
    "features/content/components/about-screen.tsx",
  ];

  const seenTitles = new Set();
  const seenDescriptions = new Set();

  for (const relPath of routes) {
    const meta = extractStaticSeoMeta(relPath);
    assert.ok(
      meta.renderedTitle.length >= 45 && meta.renderedTitle.length <= 60,
      `${relPath} rendered title length ${meta.renderedTitle.length} out of [45, 60]: "${meta.renderedTitle}"`
    );
    assert.ok(
      meta.description.length >= 130 && meta.description.length <= 155,
      `${relPath} description length ${meta.description.length} out of [130, 155]: "${meta.description}"`
    );
    assert.equal(seenTitles.has(meta.renderedTitle), false, `Duplicate title: ${meta.renderedTitle}`);
    assert.equal(seenDescriptions.has(meta.description), false, `Duplicate description: ${meta.description}`);
    seenTitles.add(meta.renderedTitle);
    seenDescriptions.add(meta.description);
  }
});

test("CMS document page fallbacks produce 45–60 char titles and 130–155 char descriptions", () => {
  const code = readFileSync(resolve(shopSrc, "features/content/lib/page-metadata.ts"), "utf8");
  const slugs = ["payment-delivery", "returns", "offer", "privacy"];

  for (const slug of slugs) {
    const blockRe = new RegExp(`["']?${slug}["']?:\\s*\\{\\s*title:\\s*"([^"]+)",\\s*description:\\s*"([^"]+)"`, "m");
    const match = code.match(blockRe);
    assert.ok(match, `Fallback metadata missing for ${slug}`);
    const rendered = renderTitle(match[1]);
    const desc = match[2];
    assert.ok(rendered.length >= 45 && rendered.length <= 60, `${slug} title len ${rendered.length}: "${rendered}"`);
    assert.ok(desc.length >= 130 && desc.length <= 155, `${slug} desc len ${desc.length}: "${desc}"`);
  }
});

test("homepage route no longer renders redundant Breadcrumbs above hero", () => {
  const homePageCode = readFileSync(resolve(shopSrc, "app/(shop)/page.tsx"), "utf8");
  assert.equal(homePageCode.includes("Breadcrumbs"), false);
});

test("about-screen.tsx includes expanded E-E-A-T copy for Bucha store and Kyiv Oblast services", () => {
  const code = readFileSync(resolve(shopSrc, "features/content/components/about-screen.tsx"), "utf8");
  for (const needle of ["Poli Valko", "Депутатська, 1-В", "Варшавський", "Ірпені", "Гостомелі", "Ворзелі"]) {
    assert.ok(code.includes(needle), `about-screen.tsx missing E-E-A-T signal: ${needle}`);
  }
});

test("formatProductTitle guards long product titles within 65 rendered chars and enriches short raw names", () => {
  const { formatProductTitle } = src("features/product/lib/product-seo.ts");
  const money = (value) => ({ value, currency: "UAH" });

  // Preserve well-sized explicit CMS titles unchanged.
  assert.equal(
    formatProductTitle({
      name: "Зерно від мишей Bross 300 г",
      brand: "Bross",
      price: money("130.00"),
      seoTitle: "Зерно від мишей Bross 300 г, ціна 130 грн",
    }),
    "Зерно від мишей Bross 300 г, ціна 130 грн"
  );

  // Bloated 85+ char templated title is trimmed cleanly so rendered title (with " | Poli Valko") <= 65 chars.
  const bloated = formatProductTitle({
    name: "Лопата для снігу з держаком (жовта, синя)(135*46*46)",
    brand: null,
    price: money("375.00"),
    seoTitle: "Лопата для снігу з держаком (жовта, синя)(135*46*46): ціна 375 грн, купити з доставкою",
  });
  assert.ok(renderTitle(bloated).length <= 65, `Bloated title too long (${renderTitle(bloated).length}): ${bloated}`);

  // Ultra-long product name clips at word boundary with no dangling prepositions.
  const ultraLong = formatProductTitle({
    name: "Контролер автоматичного поливу Hunter X-Core XC-801-E для восьми зон настінного монтажу з датчиком дощу",
    brand: "Hunter",
    price: money("6450.00"),
    seoTitle: null,
  });
  assert.ok(renderTitle(ultraLong).length <= 65, `Ultra-long title too long (${renderTitle(ultraLong).length}): ${ultraLong}`);
  assert.doesNotMatch(ultraLong, /\s+(для|з|та|і|в|у|на)$/i);

  // Short raw product name without seoTitle gets enriched into 45–65 rendered chars.
  const shortTitle = formatProductTitle({
    name: "Агроперліт 1 л",
    brand: null,
    price: money("40.00"),
    seoTitle: null,
  });
  assert.ok(
    renderTitle(shortTitle).length >= 45 && renderTitle(shortTitle).length <= 65,
    `Short title length ${renderTitle(shortTitle).length} out of [45, 65]: ${shortTitle}`
  );
});

test("brandSeoTitle and brandSeoMetaDescription stay within strict SERP character bounds for all brand lengths", () => {
  const { brandSeoTitle, brandSeoDescription, brandSeoMetaDescription } = src("features/catalog/lib/brand-seo.ts");

  for (const name of ["ICL", "BROS", "Hunter", "Irritec", "Cellfast", "Fiskars", "Spear & Jackson"]) {
    const rendered = renderTitle(brandSeoTitle(name));
    assert.ok(rendered.length >= 45 && rendered.length <= 60, `Brand ${name} title len ${rendered.length}: "${rendered}"`);
    const paged = renderTitle(brandSeoTitle(name, 2));
    assert.ok(paged.length >= 45 && paged.length <= 65, `Brand ${name} paged title len ${paged.length}: "${paged}"`);
    const fallbackDesc = brandSeoDescription({ name, description: null, productCount: 68 });
    assert.ok(fallbackDesc.length >= 130 && fallbackDesc.length <= 155, `Brand ${name} desc len ${fallbackDesc.length}: "${fallbackDesc}"`);
  }

  // Short brand descriptions (< 120 chars) expand cleanly to 130–155 chars.
  const shortSamples = [
    { name: "FÖRSTER", description: "FÖRSTER — надійні садові інструменти та аксесуари для щоденної роботи.", productCount: 5 },
    { name: "NeRest", description: "NeRest — товари для комфортного відпочинку на природі, кемпінгу та пікніка з міцних матеріалів.", productCount: 5 },
    { name: "Vodaland", description: "Vodaland — системи поверхневого водовідведення та облаштування ділянок для приватних будинків і садів.", productCount: 6 },
  ];
  for (const sample of shortSamples) {
    const meta = brandSeoMetaDescription(sample);
    assert.ok(meta.length >= 130 && meta.length <= 155, `Short brand ${sample.name} meta len ${meta.length}: "${meta}"`);
  }
});

test("brands/[slug]/page.tsx wires brandSeoTitle and brandSeoMetaDescription", () => {
  const code = readFileSync(resolve(shopSrc, "app/(shop)/brands/[slug]/page.tsx"), "utf8");
  assert.ok(code.includes("brandSeoTitle("), "brands/[slug]/page.tsx must use brandSeoTitle");
  assert.ok(code.includes("brandSeoMetaDescription("), "brands/[slug]/page.tsx must use brandSeoMetaDescription");
});

test("formatProductDescription clamps >158-char overflow and enriches short templated descriptions to 120–158 chars", () => {
  const { formatProductDescription } = src("features/product/lib/product-seo.ts");

  // Descriptions longer than 158 chars are clipped cleanly.
  const overflow =
    "Квіти петунія великоквіткова низькоросла Пікоті Бургунд F1 SeedEra, 10 шт у магазині Poli Valko: доставка Новою поштою по Україні або самовивіз з магазину Буча.";
  const clamped = formatProductDescription({ seoDescription: overflow, descriptionHtml: null });
  assert.ok(clamped.length <= 158, `Overflow desc length ${clamped.length} > 158: "${clamped}"`);

  // Short templated product descriptions expand into 120–158 chars without duplicating delivery text.
  const shortTemplated =
    "Триходермін 1 кг у магазині Poli Valko: доставка Новою поштою по Україні або самовивіз з магазину.";
  const expanded = formatProductDescription({ seoDescription: shortTemplated, descriptionHtml: null });
  assert.ok(expanded.length >= 120 && expanded.length <= 158, `Expanded desc length ${expanded.length}: "${expanded}"`);
  assert.match(expanded, /ТК «Варшавський»/);

  // Short HTML fallback expands with full store USP cleanly into 120–158 chars.
  const fromHtml = formatProductDescription({
    seoDescription: null,
    descriptionHtml: "<p>Агроперліт 1 л — легка мінеральна добавка для розсади та кімнатних рослин.</p>",
  });
  assert.ok(fromHtml.length >= 120 && fromHtml.length <= 158, `HTML desc length ${fromHtml.length}: "${fromHtml}"`);
  assert.match(fromHtml, /ТК «Варшавський»/);
});

test("duplicate H1 pairs across /brands/*, /catalog/*, and /services/* are differentiated", () => {
  const brandScreenCode = readFileSync(resolve(shopSrc, "features/catalog/components/brand-screen.tsx"), "utf8");
  const categoryHeadCode = readFileSync(resolve(shopSrc, "features/catalog/components/category-head.tsx"), "utf8");

  assert.match(brandScreenCode, /<h1>Товари бренду \{brand\.name\}<\/h1>/);
  assert.ok(categoryHeadCode.includes('"landshaftnyi-dyzain": "Товари для ландшафтного дизайну"'));
  assert.ok(categoryHeadCode.includes('hunter: "Автополив Hunter"'));
  assert.ok(categoryHeadCode.includes('irritec: "Комплектуючі для поливу Irritec"'));
});
