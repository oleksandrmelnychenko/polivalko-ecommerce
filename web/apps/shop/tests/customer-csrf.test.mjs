import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(getToken) {
  const source = readFileSync(new URL("../src/features/customer/lib/csrf.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  const modules = {
    "@polivalko/shared/api/browser": { browserApi: { GET: getToken } },
    "@polivalko/shared/api/problem": { problemOf: ({ error }) => error },
  };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, (name) => modules[name]);
  return loaded.exports;
}

test("a failed token request blocks the mutation and the next user action can retry", async () => {
  let requests = 0;
  let writes = 0;
  const { withCsrf } = load(async (route, options) => {
    requests += 1;
    assert.equal(route, "/api/v1/account/csrf");
    assert.equal(options.cache, "no-store");
    if (requests === 1) return { response: new Response(null, { status: 503 }) };
    return { response: new Response(), data: { token: "current" } };
  });
  const send = async (headers) => {
    writes += 1;
    assert.equal(headers["X-CSRF-TOKEN"], "current");
    return {};
  };

  await assert.rejects(withCsrf(send), /Не вдалося отримати захисний токен/);
  assert.equal(writes, 0);
  await withCsrf(send);
  assert.equal(writes, 1);
});

test("concurrent rejections for the old token share one refresh", async () => {
  let requests = 0;
  const { withCsrf } = load(async () => {
    requests += 1;
    return { response: new Response(), data: { token: requests === 1 ? "first" : "refreshed" } };
  });
  const send = async (headers) => headers["X-CSRF-TOKEN"] === "first" ? { error: { code: "auth.csrf_invalid" } } : {};
  assert.deepEqual(await Promise.all([withCsrf(send), withCsrf(send)]), [{}, {}]);
  assert.equal(requests, 2);
});
