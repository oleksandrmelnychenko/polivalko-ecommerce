import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

function load(getMe, window, document) {
  const source = readFileSync(new URL("../src/features/customer/lib/session-store.ts", import.meta.url), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const loaded = { exports: {} };
  new Function("exports", "module", "require", "window", "document", js)(loaded.exports, loaded, () => ({ getMe }), window, document);
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

test("a private request waits for a verified account after another tab changes the session marker", async () => {
  const signals = new Map();
  const window = { localStorage: { getItem: (name) => signals.get(name) ?? null, setItem: (name, value) => signals.set(name, value) } };
  const store = load(async () => ({ data: { id: "incoming" }, response: new Response() }), window);
  store.setSignedIn({ id: "previous" });
  signals.set(store.SESSION_SIGNAL, "another-tab");
  let calls = 0;
  const send = async () => {
    calls += 1;
    return { response: new Response() };
  };
  await assert.rejects(store.withActiveSession(send, "previous"), /Сеанс змінився/);
  assert.equal(calls, 0);

  await store.refreshChangedSession();
  await assert.rejects(store.withActiveSession(send, "previous"), /Сеанс змінився/);
  assert.equal(calls, 0);
  await store.withActiveSession(send, "incoming");
  assert.equal(calls, 1);
});

test("a profile update does not invalidate requests for the same verified account", async () => {
  const pending = Promise.withResolvers();
  const store = load(() => { throw new Error("Unexpected refresh"); });
  store.setSignedIn({ id: "current", name: "Old" });
  const privateRead = store.withActiveSession(() => pending.promise, "current");
  store.updateCustomerDetails({ id: "current", name: "New" });
  pending.resolve({ response: new Response() });
  await privateRead;
  assert.equal(store.getSession().me.name, "New");
});

test("a guest action requires the verified guest session", async () => {
  const store = load(() => { throw new Error("Unexpected refresh"); });
  let calls = 0;
  const send = async () => {
    calls += 1;
    return { response: new Response() };
  };
  await assert.rejects(store.withActiveSession(send, null), /Сеанс змінився/);
  store.setSignedOut();
  await store.withActiveSession(send, null);
  store.setSignedIn({ id: "customer" });
  await assert.rejects(store.withActiveSession(send, null), /Сеанс змінився/);
  assert.equal(calls, 1);
});

test("password recovery notifies other tabs and verifies the actual browser session", async () => {
  const signals = new Map();
  const window = { localStorage: { getItem: (name) => signals.get(name) ?? null, setItem: (name, value) => signals.set(name, value) } };
  const store = load(async () => ({ data: { id: "unrelated" }, response: new Response() }), window);
  store.setSignedIn({ id: "unrelated" });
  const previousSignal = signals.get(store.SESSION_SIGNAL);
  await store.refreshSessionAcrossTabs();
  assert.notEqual(signals.get(store.SESSION_SIGNAL), previousSignal);
  assert.equal(store.getSession().me.id, "unrelated");
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

test("an anonymous visitor on a public page resolves to guest without calling /api/v1/account/me", async () => {
  let calls = 0;
  const document = { cookie: "" };
  const window = { location: { pathname: "/", protocol: "https:" } };
  const store = load(async () => {
    calls += 1;
    return { response: new Response(null, { status: 401 }) };
  }, window, document);

  const result = await store.loadSession();
  assert.equal(result.status, "guest");
  assert.equal(result.me, null);
  assert.equal(calls, 0);
});

test("a visitor with the pv_customer_hint cookie verifies their session via /api/v1/account/me", async () => {
  let calls = 0;
  const document = { cookie: "pv_customer_hint=1" };
  const window = { location: { pathname: "/catalog/vse-dlia-polyvu", protocol: "https:" } };
  const store = load(async () => {
    calls += 1;
    return { data: { id: "signed-in-customer" }, response: new Response() };
  }, window, document);

  const result = await store.loadSession();
  assert.equal(result.status, "signedIn");
  assert.equal(result.me.id, "signed-in-customer");
  assert.equal(calls, 1);
});

test("an /account route still checks /api/v1/account/me even without the hint cookie and backfills it on success", async () => {
  let calls = 0;
  const document = { cookie: "" };
  const window = { location: { pathname: "/account/orders", protocol: "https:" } };
  const store = load(async () => {
    calls += 1;
    return { data: { id: "legacy-cookie-customer" }, response: new Response() };
  }, window, document);

  const result = await store.loadSession();
  assert.equal(result.status, "signedIn");
  assert.equal(calls, 1);
  assert.match(document.cookie, /^pv_customer_hint=1;/);
});

test("signing out clears the pv_customer_hint cookie", () => {
  const document = { cookie: "pv_customer_hint=1" };
  const window = { location: { pathname: "/", protocol: "https:" } };
  const store = load(async () => { throw new Error("Unexpected getMe"); }, window, document);
  store.setSignedOut();
  assert.match(document.cookie, /^pv_customer_hint=;.*Max-Age=0/);
});
