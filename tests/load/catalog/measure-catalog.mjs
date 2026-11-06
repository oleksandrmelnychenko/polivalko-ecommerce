import { ConsoleClient, parseArgs, send } from "./console-client.mjs";

const args = parseArgs(process.argv.slice(2));
const BASE = args.base ?? "http://127.0.0.1:8080";
const SHOP_HOST = args["shop-host"] ?? "localhost:8080";
const CONSOLE_HOST = args["console-host"] ?? "console.localhost:8080";
const RUNS = Number(args.runs ?? 7);
const ONLY = args.only;

async function timed(fetcher) {
  const started = performance.now();
  const response = await fetcher();
  const body = response.text;
  const ms = performance.now() - started;
  if (!response.ok) throw new Error(`${response.status}: ${body.slice(0, 300)}`);
  return { ms, body };
}

const shop = (path) => () => send(BASE, SHOP_HOST, path);

function stats(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
  return { median: at(0.5), max: sorted[sorted.length - 1] };
}

async function measure(name, fetcher, describe) {
  if (ONLY && !name.includes(ONLY)) return null;
  let first;
  try {
    first = await timed(fetcher);
  } catch (error) {
    console.log(`${name.padEnd(46)} пропущено: ${error.message.slice(0, 120)}`);
    return null;
  }
  const samples = [];
  for (let i = 0; i < RUNS; i += 1) samples.push((await timed(fetcher)).ms);
  const { median, max } = stats(samples);
  const row = { name, first: Math.round(first.ms), median: Math.round(median), max: Math.round(max), note: describe ? describe(first.body) : "" };
  console.log(`${name.padEnd(46)} перший ${String(row.first).padStart(5)} мс · медіана ${String(row.median).padStart(5)} мс · макс ${String(row.max).padStart(5)} мс  ${row.note}`);
  return row;
}

const total = (body) => {
  const data = JSON.parse(body);
  return `знайдено ${data.totalItems ?? "?"}${data.approximate ? " (схожі)" : ""}`;
};
const bytes = (body) => `${(body.length / 1024).toFixed(0)} КБ`;
const urls = (body) => `${(body.match(/<loc>/g) ?? []).length || JSON.parse(body).length || "?"} адрес · ${bytes(body)}`;

const tree = JSON.parse((await send(BASE, SHOP_HOST, "/api/v1/categories")).text);
const flat = [];
const walk = (nodes) => nodes.forEach((n) => { flat.push(n); walk(n.children ?? []); });
walk(Array.isArray(tree) ? tree : tree.items ?? []);
const bySlugName = (name) => flat.find((c) => c.name === name)?.slug;
const watering = bySlugName("Все для поливу");
const hoses = bySlugName("Шланги поливальні");
const mowers = bySlugName("Газонокосарки");
const product = JSON.parse((await timed(shop("/api/v1/products?q=SYN-00042"))).body).items?.[0]?.slug;
const enc = encodeURIComponent;

console.log(`Категорії: ${flat.length}; полив=${watering}, шланги=${hoses}, косарки=${mowers}, товар=${product}`);
console.log("— API вітрини");
const rows = [];
rows.push(await measure("Усі товари, стор. 1", shop("/api/v1/products?pageSize=24"), total));
rows.push(await measure("Усі товари, стор. 200", shop("/api/v1/products?pageSize=24&page=200"), total));
rows.push(await measure("Усі товари, ціна ↓, в наявності, акція", shop("/api/v1/products?sort=price_desc&inStock=true&onSale=true"), total));
rows.push(await measure("Категорія верхня з фасетами", shop(`/api/v1/products?category=${watering}`), total));
rows.push(await measure("Підкатегорія + 2 фільтри характеристик", shop(`/api/v1/products?category=${hoses}&f=${enc("Довжина:20 м")}&f=${enc("Діаметр:3/4\"")}`), total));
rows.push(await measure("Підкатегорія + бренд + ціна", shop(`/api/v1/products?category=${mowers}&brand=Makita,Bosch&priceMin=5000&priceMax=20000&sort=price_asc`), total));
rows.push(await measure("Пошук «шланг»", shop(`/api/v1/products?q=${enc("шланг")}`), total));
rows.push(await measure("Пошук «шланг gardena 20»", shop(`/api/v1/products?q=${enc("шланг gardena 20")}`), total));
rows.push(await measure("Пошук з помилкою «газонокасарка»", shop(`/api/v1/products?q=${enc("газонокасарка")}`), total));
rows.push(await measure("Пошук без результату «xyzqwe»", shop(`/api/v1/products?q=xyzqwe`), total));
rows.push(await measure("Пошук за артикулом SYN-07777", shop(`/api/v1/products?q=SYN-07777`), total));
rows.push(await measure("Пошук у категорії «секатор»", shop(`/api/v1/products?category=${bySlugName("Ручний інструмент")}&q=${enc("секатор")}`), total));
if (product) rows.push(await measure("Картка товару", shop(`/api/v1/products/${product}`), bytes));
rows.push(await measure("Дерево категорій", shop("/api/v1/categories"), bytes));
rows.push(await measure("Дані для sitemap", shop("/api/v1/catalog/sitemap"), bytes));

console.log("— Сторінки вітрини (Next)");
rows.push(await measure("sitemap.xml", shop("/sitemap.xml"), urls));
rows.push(await measure("Головна", shop("/"), bytes));
rows.push(await measure("Сторінка категорії", shop(`/catalog/${watering}`), bytes));
rows.push(await measure("Сторінка підкатегорії з фільтром", shop(`/catalog/${hoses}?f=${enc("Довжина:20 м")}`), bytes));
rows.push(await measure("Сторінка пошуку", shop(`/search?q=${enc("секатор")}`), bytes));
if (product) rows.push(await measure("Сторінка товару", shop(`/product/${product}`), bytes));

console.log("— Консоль");
const api = new ConsoleClient(BASE, CONSOLE_HOST);
await api.login();
const con = (path) => () => api.request(path);
rows.push(await measure("Список товарів, стор. 1", con("/api/v1/console/catalog/products?pageSize=50"), total));
rows.push(await measure("Список товарів, стор. 150", con("/api/v1/console/catalog/products?pageSize=50&page=150"), total));
rows.push(await measure("Лічильники товарів", con("/api/v1/console/catalog/products/counts"), bytes));
rows.push(await measure("Пошук у консолі «пістолет»", con(`/api/v1/console/catalog/products?q=${enc("пістолет")}`), total));
rows.push(await measure("Без фото / опису / характеристик", con("/api/v1/console/catalog/products?fill=any-missing"), total));
rows.push(await measure("Приховані з залишком", con("/api/v1/console/catalog/products?hiddenWithStock=true"), total));
rows.push(await measure("Категорії консолі", con("/api/v1/console/catalog/categories"), bytes));
rows.push(await measure("Характеристики", con("/api/v1/console/catalog/attributes"), bytes));
rows.push(await measure("Бренди", con("/api/v1/console/catalog/brands"), bytes));

if (args.json) {
  const { writeFileSync } = await import("node:fs");
  writeFileSync(args.json, JSON.stringify(rows.filter(Boolean), null, 2));
}
