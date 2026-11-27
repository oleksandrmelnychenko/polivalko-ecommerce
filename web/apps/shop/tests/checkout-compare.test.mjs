import { test } from "node:test";
import assert from "node:assert/strict";
import { loadShop } from "./helpers/load-ts.mjs";

const { comparisonGroup, comparisonRows } = loadShop("features/compare/model.ts");
const { orderRequest } = loadShop("features/checkout/lib/order-request.ts");
const { validateOrder } = loadShop("features/checkout/lib/validate-order.ts");

const product = (category, attributes = []) => ({ id: category, slug: category, name: category, sku: category, price: { value: "100.00", currency: "UAH" }, inStock: true, category: { slug: category, name: category }, attributes });
test("separate categories and explicit types never share a comparison group", () => {
  assert.notEqual(comparisonGroup(product("vidra")).key, comparisonGroup(product("lopaty")).key);
  assert.notEqual(comparisonGroup(product("instrument", [{ name: "Тип", value: "Відро" }])).key, comparisonGroup(product("instrument", [{ name: "Тип", value: "Лопата" }])).key);
  assert.equal(comparisonGroup(product("instrument", [{ name: "Тип", value: " Лопата " }])).key, comparisonGroup(product("instrument", [{ name: "Тип", value: "лопата" }])).key);
});
test("legacy items without category cannot be silently mixed", () => {
  assert.notEqual(comparisonGroup({ ...product("one"), category: undefined }).key, comparisonGroup({ ...product("two"), category: undefined }).key);
});
test("differences align attributes by name and detect missing values", () => {
  const rows = comparisonRows([product("same", [{ name: "Матеріал", value: "Метал" }, { name: "Об’єм", value: "10 л" }]), product("same", [{ name: "матеріал", value: " метал " }])]);
  assert.equal(rows.find(row => row.key === "attr:матеріал").differs, false);
  assert.equal(rows.find(row => row.key === "attr:об’єм").differs, true);
  assert.deepEqual(rows.find(row => row.key === "attr:об’єм").values, ["10 л", "—"]);
});
const context = { items: [], quote: { total: { value: "100.00" } }, delivery: "pickup", settlement: null, warehouseRef: "", payment: "cash" };
test("price and availability participate in comparison differences", () => {
  const first = product("same");
  const second = { ...product("same"), price: { value: "150.00", currency: "UAH" }, inStock: false };
  const rows = comparisonRows([first, second]);
  assert.equal(rows.find(row => row.key === "price").differs, true);
  assert.equal(rows.find(row => row.key === "availability").differs, true);
  assert.equal(comparisonRows([first, { ...first, price: { value: "100", currency: "UAH" } }]).find(row => row.key === "price").differs, false);
});
function form() {
  const data = new FormData();
  Object.entries({ name: "Олена Покупець", phone: "+380671111111", email: "buyer@example.com", recipientName: "Іван Отримувач", recipientPhone: "+380672222222", comment: "  Передати після 15:00  ", acceptOffer: "on" }).forEach(([key, value]) => data.set(key, value));
  return data;
}
test("separate recipient does not replace buyer, comment is preserved", () => {
  const data = form(); data.set("otherRecipient", "on");
  const request = orderRequest(data, context);
  assert.equal(request.customer.name, "Олена Покупець");
  assert.equal(request.recipient.name, "Іван Отримувач");
  assert.equal(request.comment, "Передати після 15:00");
  assert.deepEqual(validateOrder(request), {});
});
test("unchecked recipient ignores retained hidden fields", () => {
  const request = orderRequest(form(), context);
  assert.equal(request.recipient, null);
  assert.deepEqual(validateOrder(request), {});
});
test("recipient and delivery errors block checkout before API submission", () => {
  const data = form(); data.set("otherRecipient", "on"); data.set("recipientName", ""); data.set("recipientPhone", "123");
  const errors = validateOrder(orderRequest(data, { ...context, delivery: "nova_poshta_courier" }));
  for (const field of ["recipient.name", "recipient.phone", "delivery.settlementRef", "delivery.address.street", "delivery.address.house"]) assert.ok(errors[field]);
});
