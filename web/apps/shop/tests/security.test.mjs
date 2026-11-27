import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));

function load(relative, seen = new Map()) {
  const fullPath = resolve(here, relative);
  if (seen.has(fullPath)) return seen.get(fullPath).exports;
  const source = readFileSync(fullPath, "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  seen.set(fullPath, loaded);
  const localRequire = (specifier) => {
    if (specifier.startsWith(".")) {
      return load(resolve(dirname(fullPath), `${specifier}.ts`), seen);
    }
    throw new Error(`Unexpected import ${specifier} in ${fullPath}`);
  };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, localRequire);
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

test("analytics blocks private, token-bearing, and local URLs while forwarding clean public events", () => {
  const { cleanPageLocation, isAnalyticsAllowedLocation, isPrivateAnalyticsPath } = load("../src/features/analytics/lib/privacy.ts");
  const { track } = load("../src/features/analytics/lib/track.ts");

  for (const path of ["/order", "/order/PV-1", "/account", "/account/reset-password", "/account/confirm-email", "/pay/sandbox/123"]) {
    assert.equal(isPrivateAnalyticsPath(path), true, path);
  }
  for (const path of ["/", "/catalog", "/catalog/shlanhy", "/product/hose-1", "/checkout", "/contacts"]) {
    assert.equal(isPrivateAnalyticsPath(path), false, path);
  }

  // Private, token-bearing, local, or preview URLs must never invoke gtag or create dataLayer.
  for (const href of [
    "https://www.poli-valko.com/order/1?token=secret",
    "https://www.poli-valko.com/account/reset-password?token=secret",
    "https://www.poli-valko.com/catalog?token=leaked",
    "http://localhost:3000/product/hose-1",
    "https://polivalko-preview.vercel.app/product/hose-1",
  ]) {
    globalThis.window = { location: { href }, gtag() { throw new Error(`Unexpected collection for ${href}`); } };
    assert.equal(isAnalyticsAllowedLocation(globalThis.window.location), false, href);
    track("purchase", { transaction_id: "1" });
    assert.equal(globalThis.window.dataLayer, undefined);
  }

  // Public production URLs strip query strings and forward sanitized events to gtag.
  const sent = [];
  globalThis.window = {
    location: {
      href: "https://www.poli-valko.com/product/hose-1?utm_source=google&fbclid=abc",
      origin: "https://www.poli-valko.com",
      hostname: "www.poli-valko.com",
      pathname: "/product/hose-1",
      search: "?utm_source=google&fbclid=abc",
    },
    gtag(...args) {
      sent.push(args);
    },
  };
  assert.equal(isAnalyticsAllowedLocation(globalThis.window.location), true);
  assert.equal(cleanPageLocation(globalThis.window.location), "https://www.poli-valko.com/product/hose-1");
  track("add_to_cart", { currency: "UAH", value: 120 });
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], [
    "event",
    "add_to_cart",
    { currency: "UAH", value: 120, page_location: "https://www.poli-valko.com/product/hose-1" },
  ]);
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
  const liqpay = "https://www.liqpay.ua/api/3/checkout?data=eyJ2IjozfQ%3D%3D&signature=abc%3D";
  assert.equal(paymentPageUrl(liqpay, origin), liqpay);
  assert.equal(paymentPageUrl("https://www.liqpay.ua/api/request?data=x&signature=y", origin), null);
  assert.equal(paymentPageUrl("https://liqpay.ua.example.test/api/3/checkout?data=x&signature=y", origin), null);
  assert.equal(paymentPageUrl("https://example.test/checkout", origin), null);
  assert.equal(paymentPageUrl(guest, origin), null);
  assert.equal(sandboxReturnUrl(guest, origin, "PV-42"), guest);
  assert.equal(sandboxReturnUrl(account, origin, "PV-42"), account);
  assert.equal(sandboxReturnUrl(account, origin, "PV-43"), null);
  assert.equal(sandboxReturnUrl(vendor, origin, "PV-42"), null);
});
