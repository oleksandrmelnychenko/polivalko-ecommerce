import { request as httpRequest } from "node:http";

const args = Object.fromEntries(
  process.argv.slice(2).map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, "").split("=");
    return [key, rest.length ? rest.join("=") : "true"];
  }),
);
const BASE = args.base ?? "http://127.0.0.1:8080";
const HOST = args.host ?? "localhost:8080";

function send(path) {
  const url = new URL(path, BASE);
  return new Promise((resolve, reject) => {
    const req = httpRequest(
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
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map(([tag]) => attributes(tag));
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map(([tag]) => attributes(tag));
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
    title: decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "").trim(),
    description: meta("description"),
    robots: meta("robots") ?? "",
    canonical: links.find((l) => l.rel === "canonical")?.href,
    ogTitle: meta("og:title"),
    ogUrl: meta("og:url"),
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
  } else {
    check(path, "індексується", indexed, seo.robots || "за замовчуванням");
    check(path, "description", Boolean(seo.description?.trim()), seo.description ?? "");
  }
  if (expect.canonical) {
    const canonical = seo.canonical ? new URL(seo.canonical) : null;
    const actual = canonical ? canonical.pathname + canonical.search : "";
    check(path, "canonical", actual === expect.canonical, actual || "немає");
  }
  if (expect.og) check(path, "og:title і og:url", Boolean(seo.ogTitle && seo.ogUrl), `${seo.ogTitle ?? "—"} · ${seo.ogUrl ?? "—"}`);
  check(path, "JSON-LD без помилок", seo.jsonErrors.length === 0, seo.jsonErrors.join("; "));
  for (const type of expect.types ?? []) check(path, `JSON-LD ${type}`, seo.types.has(type), [...seo.types].join(", ") || "немає");
}

const robots = await send("/robots.txt");
check("/robots.txt", "HTTP 200", robots.status === 200, String(robots.status));
check("/robots.txt", "Sitemap", /^Sitemap:\s*\S+\/sitemap\.xml$/m.test(robots.text));
check("/robots.txt", "пошук не закритий", !/^Disallow:\s*\/search/m.test(robots.text));
check("/robots.txt", "кошик закритий", /^Disallow:\s*\/cart/m.test(robots.text));

const sitemap = await send("/sitemap.xml");
check("/sitemap.xml", "HTTP 200", sitemap.status === 200, String(sitemap.status));
const paths = urlsFromSitemap(sitemap.text);
check("/sitemap.xml", "є розділи й товари", paths.some((p) => p.startsWith("/catalog/")) && paths.some((p) => p.startsWith("/product/")), `${paths.length} адрес`);
const category = args.category ? `/catalog/${args.category}` : paths.find((p) => p.startsWith("/catalog/"));
const product = args.product ? `/product/${args.product}` : paths.find((p) => p.startsWith("/product/"));

await inspect("/", { canonical: "/", og: true, types: ["Organization", "Store", "WebSite"] });
await inspect("/catalog", { canonical: "/catalog", og: true, types: ["BreadcrumbList", "ItemList"] });
if (category) {
  await inspect(category, { canonical: category, og: true, types: ["BreadcrumbList", "ItemList"] });
  await inspect(`${category}?page=2`, { canonical: `${category}?page=2` });
  await inspect(`${category}?inStock=true`, { noindex: true, follow: true, canonical: category });
  await inspect(`${category}?sort=price_desc`, { noindex: true, follow: true, canonical: category });
}
if (product) await inspect(product, { canonical: product, og: true, types: ["Product", "Offer", "BreadcrumbList"] });
await inspect("/contacts", { canonical: "/contacts", og: true, types: ["ContactPage", "Organization", "BreadcrumbList"] });
await inspect("/services", { canonical: "/services", og: true, types: ["BreadcrumbList"] });
for (const page of ["/payment-delivery", "/returns", "/offer", "/privacy"]) await inspect(page, { canonical: page, og: true, types: ["BreadcrumbList"] });
await inspect("/search?q=%D0%BF%D0%BE%D0%BB%D0%B8%D0%B2", { noindex: true, follow: true });
for (const page of ["/cart", "/checkout", "/account/login"]) await inspect(page, { noindex: true });

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
