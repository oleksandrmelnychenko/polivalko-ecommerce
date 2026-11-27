import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load() {
  const source = readFileSync(new URL("../../../packages/shared/lib/link-rel.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", js)(loaded.exports, loaded);
  return loaded.exports;
}

const { isInternalHref, linkRelAttributes } = load();

test("links between shop pages never get nofollow or a new tab", () => {
  for (const href of [
    "/catalog/vse-dlia-polyvu",
    "/services/montazh-avtopolyvu",
    "#faq",
    "?page=2",
    "services/hazony",
    "https://www.poli-valko.com/catalog/shlanhy",
    "https://poli-valko.com/brands/bros",
    "//www.poli-valko.com/blog",
    "HTTPS://WWW.POLI-VALKO.COM/",
    "mailto:shop@poli-valko.com",
    "tel:+380738185222",
  ]) {
    assert.equal(isInternalHref(href), true, href);
    assert.deepEqual(linkRelAttributes(href), { rel: null, target: null }, href);
  }
});

test("external links keep noopener noreferrer and open in a new tab, without nofollow", () => {
  for (const href of ["https://www.irritec.com/", "http://hunterindustries.com/products", "https://poli-valko.com.evil.test/"]) {
    assert.equal(isInternalHref(href), false, href);
    assert.deepEqual(linkRelAttributes(href), { rel: "noopener noreferrer", target: "_blank" }, href);
  }
});

test("the console's own site address counts as internal", () => {
  assert.equal(isInternalHref("https://shop.example.ua/catalog", ["shop.example.ua"]), true);
  assert.equal(isInternalHref("https://shop.example.ua/catalog"), false);
});
