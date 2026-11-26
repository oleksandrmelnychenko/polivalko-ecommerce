// Draft of pack-size groups (Product.VariantGroup / VariantLabel) built from the public storefront listing.
// Reads only; writes a CSV for the owner to review. Nothing here changes the catalog.
//
//   node build-pack-groups.mjs <dir with pages/*.json and cats.json> [details.json] > pack-groups-draft.csv
//
// pages/*.json: GET https://www.poli-valko.com/api/v1/products?pageSize=100&page=N (visible products only).
// cats.json:    GET https://www.poli-valko.com/api/v1/categories.
// details.json: optional {id: {brand, variantGroup, variantLabel}} read from the console product cards.
import fs from "node:fs";
import path from "node:path";

const [dir, detailsPath] = process.argv.slice(2);
const items = fs.readdirSync(path.join(dir, "pages")).flatMap(f => JSON.parse(fs.readFileSync(path.join(dir, "pages", f), "utf8")).items);
const details = detailsPath ? JSON.parse(fs.readFileSync(detailsPath, "utf8")) : {};
const cats = {};
(function walk(list, parents) {
  for (const c of list) {
    cats[c.id] = { slug: c.slug, path: [...parents, c.name].join(" / ") };
    walk(c.children ?? [], [...parents, c.name]);
  }
})(JSON.parse(fs.readFileSync(path.join(dir, "cats.json"), "utf8")), []);

// Goods sold by the pack: here a weight, volume or count in the name is the pack size.
const CONSUMABLES = new Set([
  "zasoby-zakhystu-roslyn", "dobryva", "shkidnyky", "hrunty-ta-dobavky", "nasinnia", "nasinnia-hazonnykh-trav",
  "septyky-y-kompost", "khimiia-dlia-baseiniv", "vuhillia-brykety-y-rozpaliuvachi", "avtotovary",
]);
const SIZE = /(\d+(?:[.,]\d+)?)\s*(кг|гр|г|мг|мл|л|шт)\.?(?![а-яіїєґa-z0-9])/giu;
const UNIT = { "мг": ["mass", 0.001, "мг"], "г": ["mass", 1, "г"], "гр": ["mass", 1, "г"], "кг": ["mass", 1000, "кг"], "мл": ["volume", 1, "мл"], "л": ["volume", 1000, "л"], "шт": ["count", 1, "шт"] };
const WEIGHED = /за\s*1\s*кг|вагов/iu;

const norm = s => s.normalize("NFKC").toLowerCase().replace(/[«»"“”„'’ʼ`]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
const tidy = s => s.replace(/\s{2,}/g, " ").replace(/\s+([,.)])/g, "$1").replace(/\(\s*\)/g, "").replace(/[\s,.;:–-]+$/u, "").replace(/^[\s,.;:–-]+/u, "").trim();

const parsed = items.map(item => {
  const sizes = [...item.name.matchAll(SIZE)];
  const cat = cats[item.categoryId] ?? { slug: "?", path: "?" };
  const brand = (details[item.id]?.brand ?? item.brand ?? "").trim();
  const row = { item, cat, brand, sizes, weighed: WEIGHED.test(item.name) };
  if (sizes.length === 0) return row;
  // The base is the name with every pack size taken out; a leading article code ("064 ...") is kept apart.
  let base = item.name;
  for (const m of sizes) base = base.replace(m[0], " ");
  const code = base.match(/^\s*(\d{2,4})\s+/u)?.[1] ?? "";
  if (code) base = base.replace(/^\s*\d{2,4}\s+/u, "");
  row.base = base;
  row.code = code;
  row.key = norm(base) + "|" + item.categoryId;
  if (sizes.length === 1) {
    const [, num, unit] = sizes[0];
    const [family, factor, shown] = UNIT[unit.toLowerCase()];
    const value = Number(num.replace(",", "."));
    row.family = family;
    row.amount = value * factor;
    row.label = `${num.replace(".", ",")} ${shown}`;
  }
  return row;
});

const byKey = new Map();
for (const row of parsed) if (row.key) (byKey.get(row.key) ?? byKey.set(row.key, []).get(row.key)).push(row);

const groups = [];
for (const rows of byKey.values()) {
  if (rows.length < 2) continue;
  const reasons = [];
  const single = rows.filter(r => r.sizes.length === 1);
  if (single.length !== rows.length) reasons.push("у назві кількох товарів кілька чисел з одиницями");
  if (rows.some(r => r.weighed)) reasons.push("ваговий товар (ціна за 1 кг), а не фасування");
  if (new Set(single.map(r => r.family)).size > 1) reasons.push("різні одиниці (вага / об'єм / штуки)");
  const amounts = single.map(r => r.amount);
  if (new Set(amounts).size !== amounts.length) reasons.push("однаковий розмір у двох товарах: можливо, дубль або інший різновид");
  else if (single.length === rows.length && new Set(single.map(r => r.family)).size === 1) {
    const sorted = [...amounts].sort((a, b) => a - b);
    if (sorted.some((a, i) => i > 0 && a / sorted[i - 1] < 1.25)) reasons.push("розміри надто близькі (напр. 300 і 350 мл): можливо, різні товари");
  }
  if (new Set(rows.map(r => r.brand.toLowerCase())).size > 1) reasons.push(`різні бренди: ${[...new Set(rows.map(r => r.brand || "без бренду"))].join(", ")}`);
  if (new Set(rows.map(r => r.code)).size > 1) reasons.push(`різні коди на початку назви: ${rows.map(r => r.code || "—").join(", ")}`);
  const cat = rows[0].cat;
  if (!CONSUMABLES.has(cat.slug)) reasons.push(`розділ «${cat.path}»: число в назві може бути місткістю, вагою виробу або кількістю в наборі, а не фасуванням`);
  if (norm(rows[0].base).split(" ").filter(w => /\p{L}{3,}/u.test(w)).length < 2) reasons.push("надто коротка назва без розміру");
  const linked = rows.filter(r => details[r.item.id]?.variantGroup);
  if (linked.length) reasons.push(`уже має групу: ${linked.map(r => details[r.item.id].variantGroup).join(", ")}`);

  rows.sort((a, b) => (a.amount ?? 0) - (b.amount ?? 0));
  // The storefront sorts labels with uk-UA NumericOrdering (CategoryQueries.NaturalOrder): digit runs compare as
  // integers, so "1 кг" < "500 г" and "0,5 г" < "0,25 г". Flag groups whose shown order would differ from the sizes.
  const natural = (a, b) => {
    const x = a.match(/\d+|\D+/g), y = b.match(/\d+|\D+/g);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
      const c = /^\d/.test(x[i]) && /^\d/.test(y[i]) ? Number(x[i]) - Number(y[i]) : x[i].localeCompare(y[i], "uk");
      if (c) return c;
    }
    return x.length - y.length;
  };
  const labels = single.length === rows.length ? rows.map(r => r.label) : [];
  const shown = [...labels].sort(natural);
  const orderNote = shown.some((l, i) => l !== labels[i]) ? `; увага: перемикач покаже кнопки в порядку ${shown.join(" / ")}` : "";
  const shortest = rows.map(r => tidy(r.base)).sort((a, b) => a.length - b.length)[0];
  groups.push({
    name: shortest,
    groupKey: `pack-${[...rows].map(r => r.item.sku).sort((a, b) => a.localeCompare(b, "uk", { numeric: true }))[0]}`,
    confidence: reasons.length ? "doubtful" : "high",
    reason: reasons.length ? reasons.join("; ") : `та сама назва без фасування, той самий розділ і бренд, розміри різні (${rows.map(r => r.label).join(" / ")})${orderNote}`,
    rows,
  });
}
groups.sort((a, b) => (a.confidence === b.confidence ? 0 : a.confidence === "high" ? -1 : 1) || a.rows[0].cat.path.localeCompare(b.rows[0].cat.path, "uk") || a.name.localeCompare(b.name, "uk"));

const csv = v => { const s = String(v ?? ""); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const out = [["group_name", "group_key", "product_id", "sku", "current_name", "pack_size", "proposed_label", "category", "brand", "confidence", "reason"].join(";")];
for (const g of groups) for (const r of g.rows) {
  out.push([g.name, g.groupKey, r.item.id, r.item.sku, r.item.name, r.sizes.map(m => m[0].trim()).join(" + "), r.label ?? "", r.cat.path, r.brand, g.confidence, g.reason].map(csv).join(";"));
}
process.stdout.write("﻿" + out.join("\r\n") + "\r\n");

const high = groups.filter(g => g.confidence === "high");
const doubtful = groups.filter(g => g.confidence !== "high");
const stats = {
  visibleProducts: items.length,
  withPackSize: parsed.filter(r => r.sizes.length).length,
  groups: groups.length,
  highGroups: high.length,
  highProducts: high.reduce((n, g) => n + g.rows.length, 0),
  doubtfulGroups: doubtful.length,
  doubtfulProducts: doubtful.reduce((n, g) => n + g.rows.length, 0),
  highByCategory: Object.fromEntries(Object.entries(high.reduce((m, g) => ({ ...m, [g.rows[0].cat.path]: (m[g.rows[0].cat.path] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1])),
  candidateIds: groups.flatMap(g => g.rows.map(r => r.item.id)),
};
fs.writeFileSync(process.env.STATS ?? "stats.json", JSON.stringify(stats, null, 1));
