import assert from "node:assert/strict";
import { test } from "node:test";
import { loadShared } from "./helpers/load-ts.mjs";

const { gtinFromAttributes, isGlobalGtin } = loadShared("lib/gtin.ts");

test("real Ukrainian EAN-13 barcodes from the catalog are GTINs", () => {
  assert.equal(isGlobalGtin("4823067702320"), true);
  assert.equal(isGlobalGtin("4823114401183"), true);
});

test("a wrong check digit is not a GTIN", () => {
  assert.equal(isGlobalGtin("4823067702321"), false);
});

test("the shop's own article numbers and in-store codes are not GTINs", () => {
  assert.equal(isGlobalGtin("11971"), false);
  assert.equal(isGlobalGtin("2000000000015"), false);
  assert.equal(isGlobalGtin("0000000000000"), false);
  assert.equal(isGlobalGtin("48230677O2320"), false);
});

test("EAN-8, UPC-A and GTIN-14 lengths are accepted with a valid check digit", () => {
  assert.equal(isGlobalGtin("96385074"), true);
  assert.equal(isGlobalGtin("036000291452"), true);
  assert.equal(isGlobalGtin("10012345678902"), true);
});

test("the barcode attribute maps to the schema.org property for its length", () => {
  assert.deepEqual(gtinFromAttributes([{ name: "Артикул", value: "12227" }, { name: "Штрихкод", value: " 4823067702320 " }]), {
    property: "gtin13",
    value: "4823067702320",
  });
  assert.equal(gtinFromAttributes([{ name: "Штрихкод", value: "11971" }]), null);
  assert.equal(gtinFromAttributes([{ name: "Об’єм", value: "4823067702320" }]), null);
});
