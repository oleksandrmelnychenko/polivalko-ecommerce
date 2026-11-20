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

test("payment navigation stays on the supported provider or the relevant shop route", () => {
  const { paymentPageUrl, sandboxReturnUrl } = load("../src/features/payment/lib/payment-url.ts");
  const origin = "http://localhost:8081";
  const sandbox = `${origin}/pay/sandbox/sbx_${"0".repeat(32)}`;
  const vendor = "https://pay.mbnk.biz/p2_example";
  const guest = `${origin}/order/PV-42?token=test&payment=return`;
  const account = `${origin}/account/orders/PV-42?payment=return`;

  assert.equal(paymentPageUrl(sandbox, origin), sandbox);
  assert.equal(paymentPageUrl(vendor, origin), vendor);
  assert.equal(paymentPageUrl("https://example.test/checkout", origin), null);
  assert.equal(paymentPageUrl(guest, origin), null);
  assert.equal(sandboxReturnUrl(guest, origin, "PV-42"), guest);
  assert.equal(sandboxReturnUrl(account, origin, "PV-42"), account);
  assert.equal(sandboxReturnUrl(account, origin, "PV-43"), null);
  assert.equal(sandboxReturnUrl(vendor, origin, "PV-42"), null);
});
