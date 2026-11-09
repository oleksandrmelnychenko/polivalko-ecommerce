import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const shop = fileURLToPath(new URL("../src/", import.meta.url));
const shared = fileURLToPath(new URL("../../../packages/shared/", import.meta.url));

/** Loads a TS module with its local imports (relative, @/ and @polivalko/shared); packages come from node_modules. */
function load(file, cache = new Map()) {
  if (cache.has(file)) return cache.get(file).exports;
  const loaded = { exports: {} };
  cache.set(file, loaded);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const local = (name) => {
    const base = name.startsWith("@/") ? resolve(shop, name.slice(2)) : name.startsWith("@polivalko/shared/") ? resolve(shared, name.slice(18)) : name.startsWith(".") ? resolve(dirname(file), name) : null;
    if (!base) return require(name);
    return load([`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync), cache);
  };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, local);
  return loaded.exports;
}

process.env.API_INTERNAL_URL = "http://api.test";
const { proxy } = load(resolve(shop, "proxy.ts"));

/** Replaces fetch with an API stub and records the URLs the proxy asked for. */
function api(answer) {
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(new URL(url));
    return answer(new URL(url));
  };
  return calls;
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const page = (path, mode) => new NextRequest(`http://shop.test${path}`, { headers: mode ? { "sec-fetch-mode": mode } : {} });
const passes = (response) => response.headers.get("x-middleware-next") === "1";
const rewrittenTo = (response) => response.headers.get("x-middleware-rewrite") && new URL(response.headers.get("x-middleware-rewrite")).pathname;

test("client navigations and prefetches skip the checks, opening a page or a crawler does not", async () => {
  const calls = api(() => json({}, 404));
  assert.ok(passes(await proxy(page("/order/PV-1?token=t", "cors"))));
  assert.ok(passes(await proxy(page("/catalog/hoses?page=9", "same-origin"))));
  assert.equal(calls.length, 0);

  assert.equal(rewrittenTo(await proxy(page("/order/PV-1?token=t", "navigate"))), "/_not-found");
  assert.equal(rewrittenTo(await proxy(page("/order/PV-1?token=t"))), "/_not-found");
  assert.equal(calls.length, 2);
});

test("an order page answers 404 unless the API may have the order for this token", async () => {
  let status = 404;
  const calls = api(() => json({}, status));
  assert.equal(rewrittenTo(await proxy(page("/order/PV-1"))), "/_not-found", "no token");
  assert.equal(rewrittenTo(await proxy(page("/order/..%2Fadmin?token=t"))), "/_not-found", "not an order number");
  assert.equal(calls.length, 0);

  for (status of [400, 401, 403, 404]) assert.equal(rewrittenTo(await proxy(page("/order/PV-1?token=wrong"))), "/_not-found", String(status));
  assert.equal(calls.at(-1).pathname, "/api/v1/orders/PV-1");
  assert.equal(calls.at(-1).searchParams.get("token"), "wrong");

  for (status of [200, 500]) assert.ok(passes(await proxy(page("/order/PV-1?token=right"))), String(status));
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  assert.ok(passes(await proxy(page("/order/PV-1?token=right"))), "the API is down: the page decides");
});

test("a listing page past the last one redirects to the last page and keeps the filters", async () => {
  const calls = api(() => json({ totalPages: 2 }));
  const response = await proxy(page("/catalog/hoses?page=4&sort=price_desc&brand=Gardena&f=Довжина:20 м"));
  assert.equal(response.status, 307);
  const target = new URL(response.headers.get("location"));
  assert.equal(target.pathname, "/catalog/hoses");
  assert.deepEqual(Object.fromEntries(target.searchParams), { brand: "Gardena", f: "Довжина:20 м", sort: "price_desc", page: "2" });

  const asked = calls[0].searchParams;
  assert.equal(calls[0].pathname, "/api/v1/products");
  assert.deepEqual([asked.get("category"), asked.get("brand"), asked.get("f"), asked.get("sort"), asked.get("page")], ["hoses", "Gardena", "Довжина:20 м", "price_desc", "4"]);

  api(() => json({ totalPages: 1 }));
  const toFirst = await proxy(page("/search?q=%20шланг%20&page=3"));
  assert.equal(toFirst.status, 307);
  assert.equal(new URL(toFirst.headers.get("location")).search, `?q=${encodeURIComponent("шланг")}`, "the first page has no page parameter");
});

test("a listing page in range, the first page or an unknown total renders as usual", async () => {
  let answer = json({ totalPages: 3 });
  const calls = api(() => answer);
  assert.ok(passes(await proxy(page("/catalog/hoses?page=3"))));
  assert.equal(calls.length, 1);

  assert.ok(passes(await proxy(page("/catalog/hoses"))));
  assert.ok(passes(await proxy(page("/catalog/hoses?page=1"))));
  assert.ok(passes(await proxy(page("/search?page=5"))), "search without a query");
  assert.equal(calls.length, 1, "none of these needs the API");

  answer = json({ totalPages: 0 });
  assert.ok(passes(await proxy(page("/catalog/missing?page=2"))), "no products: the page itself answers 404");
  answer = json({}, 503);
  assert.ok(passes(await proxy(page("/catalog/hoses?page=9"))));
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  assert.ok(passes(await proxy(page("/catalog/hoses?page=9"))));
});
