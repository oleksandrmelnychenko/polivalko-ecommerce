import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { basename, extname, resolve } from "node:path";

const apply = process.argv.includes("--apply");
const stats = process.argv.includes("--stats");
const photoFolder = process.argv.find((arg) => arg.startsWith("--photos="))?.slice(9);
const origin = "http://127.0.0.1:8081";
const routes = "/api/v1/console";
const cookies = new Map();
const mime = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp" };
let csrf;

async function request(path, { method = "GET", body } = {}) {
  const headers = {
    Host: "console.localhost:8081",
    Accept: "application/json",
    Cookie: [...cookies.values()].join("; "),
    ...(csrf && { "X-CSRF-TOKEN": csrf }),
    ...(body && !(body instanceof FormData) && { "Content-Type": "application/json" }),
  };
  let payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  if (body instanceof FormData) {
    const form = new Response(body);
    headers["Content-Type"] = form.headers.get("content-type");
    payload = Buffer.from(await form.arrayBuffer());
  }
  if (payload) headers["Content-Length"] = payload.length;

  const response = await new Promise((resolve, reject) => {
    const outgoing = httpRequest(origin + routes + path, {
      method, headers, signal: AbortSignal.timeout(30_000),
    }, async (incoming) => {
      try {
        const chunks = [];
        for await (const chunk of incoming) chunks.push(chunk);
        const content = Buffer.concat(chunks).toString("utf8");
        let data = null;
        if (content && incoming.headers["content-type"]?.includes("json")) data = JSON.parse(content);
        resolve({ status: incoming.statusCode, cookies: incoming.headers["set-cookie"] ?? [], data });
      } catch (error) {
        reject(error);
      }
    });
    outgoing.on("error", reject);
    outgoing.end(payload);
  });
  if (response.status < 200 || response.status >= 300) {
    const problem = response.data;
    const detail = problem?.errors ? JSON.stringify(problem.errors) : problem?.title ?? "";
    throw new Error(`${method} ${path}: HTTP ${response.status} ${detail}`);
  }
  for (const header of response.cookies) {
    const cookie = header.split(";", 1)[0];
    cookies.set(cookie.split("=", 1)[0], cookie);
  }
  return response.data;
}

function escapeHtml(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function auditCatalog() {
  const exportRows = JSON.parse(await readFile(new URL("../polivalko-dntrade-bucha-import.json", import.meta.url), "utf8"));
  const expected = new Map(exportRows.map((row) => [row.sku, row]));
  const actual = new Map();
  for (let page = 1, lastPage = 1; page <= lastPage; page++) {
    const result = await request(`/catalog/products?page=${page}&pageSize=100`);
    if (!Number.isInteger(result.totalPages)) throw new Error("Catalog API did not report the page count");
    lastPage = result.totalPages;
    for (const item of result.items) {
      if (expected.has(item.sku)) actual.set(item.sku, item);
    }
  }

  const summary = { total: expected.size, matched: 0, visible: 0, withDescription: 0, withPhoto: 0, complete: 0 };
  const pending = [];
  for (const [sku, source] of expected) {
    const item = actual.get(sku);
    const matched = item?.name === source.name;
    const hasDescription = matched && item.hasDescription;
    const hasPhoto = matched && Boolean(item.imageUrl);
    if (matched) summary.matched++;
    if (matched && item.isVisible) summary.visible++;
    if (hasDescription) summary.withDescription++;
    if (hasPhoto) summary.withPhoto++;
    if (hasDescription && hasPhoto) {
      summary.complete++;
      continue;
    }
    pending.push({
      sku, name: source.name, inStock: source.stock > 0,
      barcode: source.attributes.find(({ name }) => name === "Штрихкод")?.value,
      catalogArticle: source.attributes.find(({ name }) => name === "Артикул DNTrade")?.value,
      matched, needsDescription: !hasDescription, needsPhoto: !hasPhoto,
    });
  }
  pending.sort((first, second) => Number(second.inStock) - Number(first.inStock));
  await writeFile(new URL("./catalog-audit.json", import.meta.url), JSON.stringify({ summary, pending }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify(summary));
}

async function getPhotos(row, product) {
  if (!photoFolder || !row.photos?.length) return [];
  if (!/^\d+$/.test(row.sku)) throw new Error(`Invalid SKU ${row.sku}`);
  const existing = new Set(product.images.map(({ alt }) => alt));
  const plannedAlts = new Set(row.photos.map(({ alt }) => alt));
  if ([...existing].some((alt) => !plannedAlts.has(alt))) return [];

  const photos = [];
  for (const [index, { url, alt, extension: sourceExtension }] of row.photos.entries()) {
    if (existing.has(alt)) continue;
    const extension = sourceExtension ?? extname(new URL(url).pathname).toLowerCase();
    if (!mime[extension]) throw new Error(`Unsupported image type for ${row.sku}`);
    const file = resolve(photoFolder, `${row.sku}-${index + 1}${extension}`);
    const bytes = await readFile(file);
    if (!bytes.length || bytes.length > 10 * 1024 * 1024) throw new Error(`Invalid image size for ${row.sku}`);
    const photo = new FormData();
    photo.set("file", new Blob([bytes], { type: mime[extension] }), basename(file));
    photo.set("alt", alt);
    photos.push({ alt, form: photo });
  }
  return photos;
}

const credentials = execFileSync("docker", [
  "exec", "polivalko-staging-9967665-api-1", "printenv", "Seed__Users__0__Email", "Seed__Users__0__Password",
], { encoding: "utf8" }).trimEnd().split(/\r?\n/);
if (credentials.length !== 2 || credentials.some((value) => !value)) throw new Error("Staging seed account is unavailable");
const [email, password] = credentials;
await request("/auth/login", { method: "POST", body: { email, password } });
csrf = (await request("/auth/csrf")).token;

if (stats) {
  if (apply) throw new Error("Use --stats without --apply");
  await auditCatalog();
} else {
  await applyBatch();
}

async function applyBatch() {
  const batchName = process.argv.find((arg) => arg.startsWith("--batch="))?.slice(8) ?? "hunter";
  if (!/^[a-z]+$/.test(batchName)) throw new Error("Invalid batch name");
  const batch = JSON.parse(await readFile(new URL(`./${batchName}.json`, import.meta.url), "utf8"));
  const planned = [];
  for (const row of batch) {
    const results = await request(`/catalog/products?q=${encodeURIComponent(row.sku)}&pageSize=100`);
    const match = results.items.find((item) => item.sku === row.sku);
    if (!match) throw new Error(`SKU ${row.sku} not found`);
    const path = `/catalog/products/${match.id}`;
    const product = await request(path);
    if (product.navkolo.sku !== row.sku || product.navkolo.name !== row.catalogName) {
      throw new Error(`Catalog identity changed for SKU ${row.sku}: ${JSON.stringify(product.navkolo.name)} (expected ${JSON.stringify(row.catalogName)})`);
    }
    const source = new URL(row.sourceUrl);
    if (source.protocol !== "https:") throw new Error(`Unexpected source for ${row.sku}`);
    const existing = new Set(product.attributes.map(({ name }) => name.trim().toLocaleLowerCase("uk")));
    const added = row.attributes.filter(({ name }) => !existing.has(name.toLocaleLowerCase("uk")));
    const content = {
      displayName: product.displayName || row.displayName,
      slug: product.slug,
      categoryId: product.categoryId,
      brand: product.brand || row.brand,
      isVisible: product.isVisible,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      descriptionHtml: product.descriptionHtml || `<p>${escapeHtml(row.description)}</p>`,
      attributes: [...product.attributes, ...added],
    };
    const writeContent = !product.displayName || !product.brand || !product.descriptionHtml || added.length > 0;
    const photos = await getPhotos(row, product);
    planned.push({ row, product, path, content, writeContent, photos });
  }

  const missingBrands = new Set(planned.filter(({ product }) => !product.brand).map(({ row }) => row.brand));
  if (apply && missingBrands.size) {
    const brands = await request("/catalog/brands");
    const known = new Set(brands.map(({ name }) => name.toLowerCase()));
    for (const name of missingBrands) {
      if (!known.has(name.toLowerCase())) await request("/catalog/brands", { method: "POST", body: { name } });
    }
  }

  for (const { row, product, path, content, writeContent, photos } of planned) {
    let saved = product;
    if (apply && writeContent) saved = await request(path, { method: "PUT", body: content });
    if (apply) {
      for (const { alt, form } of photos) {
        saved = await request(path + "/images", { method: "POST", body: form });
        if (saved.images.every((image) => image.alt !== alt)) throw new Error(`Missing image for ${row.sku}`);
      }
      if (!saved.descriptionHtml) throw new Error(`Missing description for ${row.sku}`);
    }
    console.log(JSON.stringify({
      sku: row.sku, slug: saved.slug, content: writeContent, photos: photos.length, applied: apply,
      hasDescription: Boolean(saved.descriptionHtml), imageCount: saved.images.length, visible: saved.isVisible,
    }));
  }
}
