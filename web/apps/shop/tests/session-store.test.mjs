import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(getMe) {
  const source = readFileSync(new URL("../src/features/customer/lib/session-store.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", "require", js)(loaded.exports, loaded, () => ({ getMe }));
  return loaded.exports;
}

test("a session refresh cannot restore a customer who signed out while it was pending", async () => {
  const previous = Promise.withResolvers();
  const store = load(() => previous.promise);
  store.setSignedIn({ id: "previous" });
  const refreshed = store.refreshSession();
  store.setSignedOut();
  previous.resolve({ data: { id: "previous" }, response: new Response() });
  assert.equal((await refreshed).status, "guest");
  assert.equal(store.getSession().me, null);
});

test("a cross-tab session change supersedes the current refresh and protects the new account from a late 401", async () => {
  const previous = Promise.withResolvers();
  const incoming = Promise.withResolvers();
  const privateQuery = Promise.withResolvers();
  const checks = [previous, incoming];
  const store = load(() => checks.shift().promise);
  store.setSignedIn({ id: "previous" });
  const previousRefresh = store.refreshSession();
  const read = store.withActiveSession(() => privateQuery.promise);
  const nextRefresh = store.refreshChangedSession();
  assert.equal(store.getSession().status, "unknown");

  incoming.resolve({ data: { id: "incoming" }, response: new Response() });
  await nextRefresh;
  previous.resolve({ data: { id: "previous" }, response: new Response() });
  await previousRefresh;
  privateQuery.resolve({ response: new Response(null, { status: 401 }) });
  await assert.rejects(read, /Сеанс змінився/);
  assert.equal(store.getSession().me.id, "incoming");
});
