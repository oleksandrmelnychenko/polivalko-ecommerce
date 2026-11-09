import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(api) {
  const source = readFileSync(new URL("../src/features/cart/lib/cart-store.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  const require = (name) => name.includes("quantity") ? { MAX_QUANTITY: 999 } : name.includes("customer") ? {} : api;
  new Function("exports", "module", "require", js)(loaded.exports, loaded, require);
  return loaded.exports;
}
const empty = (id = "cart") => ({ id, revision: 0, items: [], lastOrder: null });
const line = (quantity) => ({ productId: "p", quantity, name: "Product", slug: "product", sku: "P", unitPrice: { value: "100.00", currency: "UAH" } });

test("reload reads server cart without browser storage, and repeated initialization opens once", async () => {
  let opens = 0;
  const store = load({ openCart: async () => { opens++; return { ...empty(), revision: 7, items: [line(2)] }; } });
  store.connect("guest"); store.connect("guest");
  const cart = await store.settledCart();
  assert.equal(opens, 1);
  assert.equal(cart.revision, 7);
  assert.equal(store.getSnapshot().lines[0].quantity, 2);
});

test("cart updates are serialized and a conflicting write reloads without overwriting newer contents", async () => {
  let server = { ...empty(), items: [line(1)] };
  const revisions = [];
  let conflict = false;
  const store = load({
    openCart: async () => server,
    saveCart: async (cart, items) => {
      revisions.push(cart.revision);
      if (conflict) { server = { ...server, revision: 9, items: [line(9)] }; throw new Error("cart changed"); }
      server = { ...server, revision: cart.revision + 1, items: [line(items[0].quantity)] };
      return server;
    },
  });
  store.connect("customer-a"); await store.settledCart();
  store.update((rows) => rows.map((r) => ({ ...r, quantity: r.quantity + 1 })));
  store.update((rows) => rows.map((r) => ({ ...r, quantity: r.quantity + 1 })));
  await store.settledCart();
  assert.deepEqual(revisions, [0, 1]);
  assert.equal(store.getSnapshot().lines[0].quantity, 3);
  conflict = true;
  store.update((rows) => rows.map((r) => ({ ...r, quantity: 4 })));
  await assert.rejects(store.settledCart());
  assert.equal(store.getSnapshot().lines[0].quantity, 9);
  assert.equal(store.getSnapshot().error, "cart changed");
});

test("late response from the previous account cannot replace the current account cart", async () => {
  let resolveOld;
  let opens = 0;
  const store = load({ openCart: () => ++opens === 1 ? new Promise((resolve) => { resolveOld = resolve; }) : Promise.resolve(empty("new-account")) });
  store.connect("old-account");
  store.connect("new-account");
  await store.settledCart();
  resolveOld({ ...empty("old-account"), items: [line(99)] });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(store.getSnapshot().cart.id, "new-account");
  assert.equal(store.getSnapshot().lines.length, 0);
});
