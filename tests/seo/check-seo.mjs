import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);
const BASE = args.base ?? "http://127.0.0.1:8080";
const HOST = args.host ?? (args.base ? new URL(BASE).host : "localhost:8080");

function send(path) {
  const url = new URL(path, BASE);
  return new Promise((resolve, reject) => {
    const request = url.protocol === "https:" ? httpsRequest : httpRequest;
    const req = request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: "GET",
        headers: { host: HOST, "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1; PoliValko SEO check)" },
        setHost: false,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString("utf8") }));
        res.on("error", reject);
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function decode(text) {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, name, value]) => [name.toLowerCase(), decode(value)]));
}

function parse(html) {
  const head = html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? "";
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const links = [...head.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const meta = (key) => metas.find((m) => m.name === key || m.property === key)?.content;
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, body]) => body);
  const types = new Set();
  const errors = [];
  const collect = (node) => {
    if (!node || typeof node !== "object") return;
    for (const type of [node["@type"]].flat().filter(Boolean)) types.add(type);
    Object.values(node).forEach((value) => (Array.isArray(value) ? value.forEach(collect) : collect(value)));
  };
  for (const body of blocks) {
    try {
      collect(JSON.parse(body));
    } catch (error) {
      errors.push(error.message);
    }
  }
  return {
    title: decode(head.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim(),
    description: meta("description"),
    robots: meta("robots") ?? "",
    googlebot: meta("googlebot") ?? "",
    canonical: links.find((l) => l.rel === "canonical")?.href,
    ogTitle: meta("og:title"),
    ogUrl: meta("og:url"),
    ogImage: meta("og:image"),
    types,
    jsonErrors: errors,
  };
}

function urlsFromSitemap(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(([, loc]) => new URL(decode(loc)).pathname);
}

const results = [];

function check(page, name, ok, detail = "") {
  results.push({ page, name, ok: Boolean(ok), detail });
}

async function inspect(path, expect) {
  const response = await send(path);
  check(path, "HTTP 200", response.status === 200, String(response.status));
  if (response.status !== 200) return;
  const seo = parse(response.text);
  check(path, "title", seo.title.length > 0, seo.title);
  const indexed = !/noindex/i.test(seo.robots);
  if (expect.noindex) {
    check(path, "noindex", !indexed, seo.robots || "немає meta robots");
    if (expect.follow) check(path, "follow", /(^|,\s*)follow/i.test(seo.robots), seo.robots);
    check(path, "googlebot не дозволяє індексацію", !/(^|,\s*)index/i.test(seo.googlebot), seo.googlebot || "немає meta googlebot");
  } else {
    check(path, "індексується", indexed, seo.robots || "за замовчуванням");
    check(path, "description", Boolean(seo.description?.trim()), seo.description ?? "");
    check(path, "великі прев'ю зображень", /max-image-preview:large/i.test(seo.googlebot), seo.googlebot || "немає meta googlebot");
  }
  if (expect.canonical) {
    const canonical = seo.canonical ? new URL(seo.canonical) : null;
    const actual = canonical ? canonical.pathname + canonical.search : "";
    check(path, "canonical", actual === expect.canonical, actual || "немає");
  }
  if (expect.og) check(path, "og:title, og:url та og:image", Boolean(seo.ogTitle && seo.ogUrl && seo.ogImage), `${seo.ogTitle ?? "—"} · ${seo.ogUrl ?? "—"}`);
  check(path, "JSON-LD без помилок", seo.jsonErrors.length === 0, seo.jsonErrors.join("; "));
  for (const type of expect.types ?? []) check(path, `JSON-LD ${type}`, seo.types.has(type), [...seo.types].join(", ") || "немає");
}

const robots = await send("/robots.txt");
check("/robots.txt", "HTTP 200", robots.status === 200, String(robots.status));
check("/robots.txt", "Sitemap", /^Sitemap:\s*\S+\/sitemap\.xml$/m.test(robots.text));
check("/robots.txt", "пошук не закритий", !/^Disallow:\s*\/search/m.test(robots.text));
// Кошик, оформлення й кабінет мають noindex у розмітці: робот побачить його, лише якщо сторінку можна завантажити.
check("/robots.txt", "кошик, оформлення й кабінет не закриті", !/^Disallow:\s*\/(cart|checkout|account)/m.test(robots.text));
check("/robots.txt", "API закритий", /^Disallow:\s*\/api\//m.test(robots.text));

const sitemap = await send("/sitemap.xml");
check("/sitemap.xml", "HTTP 200", sitemap.status === 200, String(sitemap.status));
let paths = [];
if (/<sitemapindex\b/i.test(sitemap.text)) {
  const childPaths = urlsFromSitemap(sitemap.text);
  check("/sitemap.xml", "індекс містить дочірні карти", childPaths.length >= 4, `${childPaths.length} карт`);
  for (const childPath of childPaths) {
    const child = await send(childPath);
    check(childPath, "HTTP 200", child.status === 200, String(child.status));
    if (child.status === 200) paths.push(...urlsFromSitemap(child.text));
  }
} else {
  paths = urlsFromSitemap(sitemap.text);
}
check("/sitemap.xml", "є розділи й товари", paths.some((p) => p.startsWith("/catalog/")) && paths.some((p) => p.startsWith("/product/")), `${paths.length} адрес`);
check("/sitemap.xml", "без юридичних сторінок /offer та /privacy", !paths.includes("/offer") && !paths.includes("/privacy"));
const category = args.category ? `/catalog/${args.category}` : paths.find((p) => p.startsWith("/catalog/"));

await inspect("/", { canonical: "/", og: true, types: ["Organization", "Store", "WebSite"] });
await inspect("/catalog", { canonical: "/catalog", og: true, types: ["BreadcrumbList", "ItemList"] });
if (category) {
  await inspect(category, { canonical: category, og: true, types: ["BreadcrumbList", "ItemList"] });
  await inspect(`${category}?page=2`, { canonical: `${category}?page=2` });
  await inspect(`${category}?inStock=true`, { noindex: true, follow: true, canonical: category });
  await inspect(`${category}?sort=price_desc`, { noindex: true, follow: true, canonical: category });
}

// Бренди: список і сторінка бренду з sitemap індексуються; сторінка з фільтром — ні.
await inspect("/brands", { canonical: "/brands", og: true, types: ["BreadcrumbList", "ItemList"] });
const brand = paths.find((p) => p.startsWith("/brands/"));
check("/sitemap.xml", "є сторінки брендів", Boolean(brand));
if (brand) {
  await inspect(brand, { canonical: brand, og: true, types: ["BreadcrumbList", "ItemList"] });
  await inspect(`${brand}?inStock=true`, { noindex: true, follow: true, canonical: brand });
}
const missingBrand = await send("/brands/brenda-takoho-nemaie");
check("/brands/brenda-takoho-nemaie", "HTTP 404", missingBrand.status === 404, String(missingBrand.status));

// Sitemap і сторінки застосовують одне правило (GetSitemap.cs, isIndexableProduct): у пошуку товар, який має фото.
// Sitemap кешується на години, тож товар, який щойно втратив фото, може недовго бути і в sitemap, і з noindex: одна
// така помилка — привід запустити перевірку ще раз, а не дефект.
const productPaths = paths.filter((p) => p.startsWith("/product/"));
const sampleSize = Number(args.sample ?? 10);
const step = Math.max(1, Math.floor(productPaths.length / sampleSize));
let pricedSample;
for (const path of productPaths.filter((_, index) => index % step === 0).slice(0, sampleSize)) {
  const response = await send(path);
  const seo = response.status === 200 ? parse(response.text) : null;
  check(path, "адреса зі sitemap індексується", Boolean(seo) && !/noindex/i.test(seo.robots), seo ? seo.robots || "за замовчуванням" : String(response.status));
  // Товар із фото, але без ціни теж є в sitemap і не має розмітки Product; повну перевірку робимо на товарі з ціною.
  if (seo?.types.has("Product")) pricedSample ??= path;
}
const product = args.product ? `/product/${args.product}` : (pricedSample ?? productPaths[0]);
if (product) await inspect(product, { canonical: product, og: true, types: ["Product", "Offer", "BreadcrumbList"] });
// Товар, якого sitemap не містить (без фото): --thin=<slug>.
if (args.thin) await inspect(`/product/${args.thin}`, { noindex: true, follow: true, canonical: `/product/${args.thin}` });
// Порожня сторінка акцій — noindex і поза sitemap; з акційними товарами вона в sitemap і індексується.
await inspect("/sale", paths.includes("/sale") ? { canonical: "/sale", og: true } : { noindex: true, follow: true });
await inspect("/contacts", { canonical: "/contacts", og: true, types: ["ContactPage", "Organization", "BreadcrumbList"] });
await inspect("/services", { canonical: "/services", og: true, types: ["BreadcrumbList"] });
for (const page of ["/payment-delivery", "/returns", "/offer", "/privacy"]) await inspect(page, { canonical: page, og: true, types: ["BreadcrumbList"] });
await inspect("/search?q=%D0%BF%D0%BE%D0%BB%D0%B8%D0%B2", { noindex: true, follow: true });
for (const page of ["/cart", "/checkout", "/account/login"]) await inspect(page, { noindex: true });

// Товарний фід для Merchant Center: XML із товарами, у кожного обов'язкові поля. Порожній фід — помилка.
const feed = await send("/feeds/google-merchant.xml");
check("/feeds/google-merchant.xml", "HTTP 200", feed.status === 200, String(feed.status));
if (feed.status === 200) {
  const items = [...feed.text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(([, body]) => body);
  check("/feeds/google-merchant.xml", "простір імен g:", feed.text.includes('xmlns:g="http://base.google.com/ns/1.0"'));
  check("/feeds/google-merchant.xml", "є товари", items.length > 0, `${items.length} товарів`);
  const required = ["g:id", "title", "description", "link", "g:image_link", "g:availability", "g:price", "g:condition"];
  const incomplete = items.filter((body) => required.some((name) => !body.includes(`<${name}>`)));
  check("/feeds/google-merchant.xml", "у кожного товару обов'язкові поля", incomplete.length === 0, `без поля: ${incomplete.length}`);
  const ids = items.map((body) => body.match(/<g:id>([^<]*)<\/g:id>/)?.[1]);
  check("/feeds/google-merchant.xml", "ідентифікатори не повторюються", new Set(ids).size === ids.length, `${ids.length - new Set(ids).size} повторів`);
  // Символи, які ламають XML: керівні, крім табуляції й переносів, і амперсанд без сутності.
  check("/feeds/google-merchant.xml", "без недопустимих символів", !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]|&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(feed.text));
}

const failed = results.filter((r) => !r.ok);
let current = "";
for (const r of results) {
  if (r.page !== current) {
    current = r.page;
    console.log(`\n${current}`);
  }
  console.log(`  ${r.ok ? "✓" : "✗"} ${r.name}${r.detail ? ` — ${r.detail.slice(0, 140)}` : ""}`);
}
console.log(`\nПеревірок: ${results.length}, не пройшло: ${failed.length}`);
process.exitCode = failed.length > 0 ? 1 : 0;
