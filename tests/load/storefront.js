// Навантажувальний тест вітрини (k6, розділ 11 ТЗ): відвідувачі переглядають сайт —
// головна → категорія → пошук → товар → перерахунок кошика (POST /api/v1/checkout/quote).
// Замовлень тест НЕ створює: виконуються лише GET-запити сторінок і перерахунок кошика.
//
//   docker run --rm -i -v "$PWD/tests/load:/scripts:ro" -e BASE_URL=https://staging.example.ua \
//     -e VUS=100 -e DURATION=10m grafana/k6:1.3.0 run /scripts/storefront.js
//
// Змінні: BASE_URL (http://localhost:8080), VUS — одночасні відвідувачі (50), DURATION — утримання
// навантаження (5m), RAMP_UP — вихід на VUS (1m), THINK_MIN/THINK_MAX — пауза між кроками, с (1/4).
// Пороги: p95 сторінок < 1,5 с, p95 API < 500 мс, помилок < 1 %. Порушення → ненульовий код виходу.
import http from "k6/http";
import { check, fail, group, sleep } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const VUS = parseInt(__ENV.VUS || "50", 10);
const DURATION = __ENV.DURATION || "5m";
const RAMP_UP = __ENV.RAMP_UP || "1m";
const THINK_MIN = parseFloat(__ENV.THINK_MIN || "1");
const THINK_MAX = parseFloat(__ENV.THINK_MAX || "4");

export const options = {
  scenarios: {
    browsing: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: RAMP_UP, target: VUS },
        { duration: DURATION, target: VUS },
        { duration: "30s", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    "http_req_duration{kind:page}": ["p(95)<1500"],
    "http_req_duration{kind:api}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
    checks: ["rate>0.99"],
  },
  summaryTrendStats: ["avg", "med", "p(90)", "p(95)", "p(99)", "max"],
};

const JSON_HEADERS = { "Content-Type": "application/json", Accept: "application/json" };

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function think() {
  sleep(THINK_MIN + Math.random() * Math.max(THINK_MAX - THINK_MIN, 0));
}

function flatten(nodes, out = []) {
  for (const node of nodes) {
    out.push(node.slug);
    flatten(node.children || [], out);
  }
  return out;
}

// Один раз перед тестом: реальні категорії, товари й пошукові слова з каталогу.
export function setup() {
  const categories = http.get(`${BASE_URL}/api/v1/categories`, { tags: { kind: "setup" } });
  if (categories.status !== 200) {
    fail(`GET /api/v1/categories → ${categories.status}. Перевірте BASE_URL (${BASE_URL}).`);
  }
  const products = http.get(`${BASE_URL}/api/v1/products?pageSize=100&inStock=true`, { tags: { kind: "setup" } });
  if (products.status !== 200) {
    fail(`GET /api/v1/products → ${products.status}`);
  }

  const items = products.json("items") || [];
  if (items.length === 0) {
    fail("У каталозі немає товарів у наявності: тест вітрини не має сенсу на порожній базі.");
  }

  const words = new Set();
  for (const item of items) {
    const word = String(item.name).split(/[\s,.()«»"]+/).find((w) => w.length >= 4);
    if (word) words.add(word.toLowerCase());
    words.add(item.sku);
  }

  return {
    categories: flatten(categories.json()),
    products: items.map((item) => ({ id: item.id, slug: item.slug })),
    searchTerms: [...words],
  };
}

function page(path, name) {
  const res = http.get(`${BASE_URL}${path}`, { tags: { kind: "page", name } });
  check(res, { [`${name}: 200`]: (r) => r.status === 200 });
  return res;
}

export default function (data) {
  group("Головна", () => {
    page("/", "home");
  });
  think();

  group("Категорія", () => {
    page(`/catalog/${pick(data.categories)}`, "/catalog/{slug}");
  });
  think();

  group("Пошук", () => {
    page(`/search?q=${encodeURIComponent(pick(data.searchTerms))}`, "/search?q=");
  });
  think();

  const product = pick(data.products);
  group("Товар", () => {
    page(`/product/${product.slug}`, "/product/{slug}");
  });
  think();

  // Кошик: 1–3 товари. Лише перерахунок цін і наявності — без POST /api/v1/orders.
  group("Перерахунок кошика", () => {
    const lines = [{ productId: product.id, quantity: 1 }];
    const extra = Math.floor(Math.random() * 3);
    for (let i = 0; i < extra; i++) {
      const other = pick(data.products);
      if (!lines.some((line) => line.productId === other.id)) {
        lines.push({ productId: other.id, quantity: 1 + Math.floor(Math.random() * 2) });
      }
    }
    const res = http.post(`${BASE_URL}/api/v1/checkout/quote`, JSON.stringify({ items: lines }), {
      headers: JSON_HEADERS,
      tags: { kind: "api", name: "POST /api/v1/checkout/quote" },
    });
    check(res, {
      "quote: 200": (r) => r.status === 200,
      "quote: є підсумок": (r) => r.status === 200 && r.json("total.value") !== undefined,
    });
  });
  think();
}
