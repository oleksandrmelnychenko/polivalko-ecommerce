import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
const shopSrc = resolve(here, "../src");
const aliases = {
  "@/": `${shopSrc}/`,
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

const src = (path) => loadTs(resolve(shopSrc, path));
const BRAND_SUFFIX = " | Poli Valko";
const renderTitle = (rawTitle, exactTitle = false) =>
  exactTitle || /poli\s*valko[\s.!?»"')]*$/i.test(rawTitle.trim())
    ? rawTitle.trim()
    : `${rawTitle.trim()}${BRAND_SUFFIX}`;

/** Extracts static string literals from seoMetadata({ title: "...", description: "...", exactTitle?: true }). */
function extractStaticSeoMeta(relPath) {
  const code = readFileSync(resolve(shopSrc, relPath), "utf8");
  const titleMatch = code.match(/title:\s*(?:paged\s*\?[^:]+:\s*)?"([^"]+)"/);
  const descMatch = code.match(/description:\s*(?:paged\s*\?[\s\S]*?:\s*)?"([^"]+)"/);
  const exactTitle = /exactTitle:\s*true/.test(code);
  assert.ok(titleMatch, `Could not find static title in ${relPath}`);
  assert.ok(descMatch, `Could not find static description in ${relPath}`);
  return {
    relPath,
    rawTitle: titleMatch[1],
    renderedTitle: renderTitle(titleMatch[1], exactTitle),
    description: descMatch[1],
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

test("HomeSeoBlock exports a Ukrainian storefront SEO section with internal links to core categories and services", () => {
  const code = readFileSync(resolve(shopSrc, "features/home/components/home-seo-block.tsx"), "utf8");
  assert.match(code, /export function HomeSeoBlock\(/);
  for (const href of [
    "/catalog/vse-dlia-polyvu",
    "/catalog/vse-dlia-roslyn",
    "/catalog/ruchnyi-instrument",
    "/services/montazh-avtopolyvu",
    "/services/hazony",
    "/about",
    "/contacts",
  ]) {
    assert.ok(code.includes(`href="${href}"`), `HomeSeoBlock missing internal link ${href}`);
  }
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

  // Well-sized explicit CMS title stays untouched (keeps seo-indexing.test.mjs green).
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

test("brandSeoTitle and brandSeoDescription stay within strict SERP character bounds", () => {
  const { brandSeoTitle, brandSeoDescription } = src("features/catalog/lib/brand-seo.ts");

  for (const name of ["Hunter", "Irritec", "Cellfast", "Fiskars", "Spear & Jackson"]) {
    const rendered = renderTitle(brandSeoTitle(name));
    assert.ok(rendered.length >= 45 && rendered.length <= 60, `Brand ${name} title len ${rendered.length}: "${rendered}"`);
    const paged = renderTitle(brandSeoTitle(name, 2));
    assert.ok(paged.length <= 65, `Brand ${name} paged title len ${paged.length}: "${paged}"`);
    const desc = brandSeoDescription({ name, description: null, productCount: 68 });
    assert.ok(desc.length >= 130 && desc.length <= 155, `Brand ${name} desc len ${desc.length}: "${desc}"`);
  }
});
