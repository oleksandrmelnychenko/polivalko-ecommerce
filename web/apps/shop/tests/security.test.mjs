import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(relative) {
  const source = readFileSync(new URL(relative, import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", js)(loaded.exports, loaded);
  return loaded.exports;
}

test("login return paths stay same-origin after URL normalization", () => {
  const { safeNext } = load("../src/features/customer/lib/login-href.ts");
  for (const path of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/\\evil.example", "//evil.example", "/folder/..//evil.example", "/%2e%2e//evil.example", "https://evil.example", "/a/../account/login"]) {
    assert.equal(safeNext(path), "/account", path);
  }
  for (const path of ["/account/orders", "/catalog?q=полив", "/account/confirm-email?token=test", "/#section"]) {
    const value = safeNext(path);
    assert.equal(new URL(value, "https://shop.example").origin, "https://shop.example");
    assert.notEqual(value, "/account");
  }
});

test("analytics does not load scripts or queue private order events", () => {
  const { GoogleAnalytics } = load("../src/features/analytics/components/google-analytics.tsx");
  const { track } = load("../src/features/analytics/lib/track.ts");
  globalThis.window = { location: { href: "https://shop.example/order/1?token=secret" }, gtag() { throw new Error("Unexpected collection"); } };
  assert.equal(GoogleAnalytics(), null);
  track("purchase", { transaction_id: "1" });
  assert.equal(globalThis.window.dataLayer, undefined);
  delete globalThis.window;
});
