"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { DownloadIcon, SearchIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import type { OrderStatus, PaymentStatus } from "@/lib/api/server";
import { useAdminData } from "@/lib/admin";
import { deliveryMethodLabel, orderStatusLabel, paymentStatusLabel } from "@/lib/labels";
import { useSummary } from "../admin-shell";
import { mutate, problemTitle } from "../catalog/_shared";
import { downloadFile, OrdersTable, PageHead, Pager, StateBox, useSelection } from "../ui";

const PAGE_SIZE = 20;
const FILTERS = ["q", "status", "paymentStatus", "delivery", "from", "to", "sort"] as const;
const sortLabel = { newest: "Спершу нові", oldest: "Спершу старі", totalDesc: "Сума: більша", totalAsc: "Сума: менша" } as const;
type Sort = keyof typeof sortLabel;

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={null}>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const f = Object.fromEntries(FILTERS.map((k) => [k, params.get(k) ?? ""])) as Record<(typeof FILTERS)[number], string>;
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const [text, setText] = useState(f.q);
  const selection = useSelection();
  const { reload: reloadSummary } = useSummary();
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [bulk, setBulk] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });
  const [exporting, setExporting] = useState(false);

  const query = {
    q: f.q || undefined,
    status: (f.status || undefined) as OrderStatus | undefined,
    paymentStatus: (f.paymentStatus || undefined) as PaymentStatus | undefined,
    delivery: f.delivery || undefined,
    from: f.from || undefined,
    to: f.to || undefined,
    sort: (f.sort || undefined) as Sort | undefined,
  };
  const key = FILTERS.map((k) => f[k]).join("|");
  const orders = useAdminData(`${key}|${page}`, () => browserApi.GET("/api/v1/admin/orders", { params: { query: { ...query, page, pageSize: PAGE_SIZE } } }));
  const counts = useAdminData(`counts|${f.q}|${f.paymentStatus}|${f.delivery}|${f.from}|${f.to}`, () =>
    browserApi.GET("/api/v1/admin/orders/counts", {
      params: { query: { q: query.q, paymentStatus: query.paymentStatus, delivery: query.delivery, from: query.from, to: query.to } },
    }),
  );

  // Стан фільтрів живе в URL: посилання на вибірку можна надіслати колезі.
  const go = (patch: Partial<Record<(typeof FILTERS)[number] | "page", string>>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    selection.clear();
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };
  const filtered = FILTERS.some((k) => k !== "sort" && f[k]);
  const countOf = (status: OrderStatus) => counts.data?.byStatus.find((s) => s.status === status)?.count ?? 0;

  async function applyBulk() {
    if (!bulkStatus) return;
    const numbers = [...selection.selected];
    setBulk({ busy: true });
    let done = 0;
    const failed: string[] = [];
    for (const number of numbers) {
      const result = await mutate((headers) =>
        browserApi.POST("/api/v1/admin/orders/{number}/status", { params: { path: { number } }, headers, body: { status: bulkStatus, reason: "Масова зміна статусу" } }),
      );
      if (result.data) done += 1;
      else failed.push(`${number}: ${problemTitle(result.error, "не змінено")}`);
    }
    selection.clear();
    setBulkStatus("");
    setBulk({
      busy: false,
      error: failed.length > 0,
      message: `Статус «${orderStatusLabel[bulkStatus]}» встановлено для ${done} з ${numbers.length}.${failed.length ? ` Пропущено: ${failed.join("; ")}.` : ""}`,
    });
    orders.reload();
    counts.reload();
    reloadSummary();
  }

  async function exportCsv() {
    setExporting(true);
    const search = new URLSearchParams(Object.entries(query).filter((e): e is [string, string] => Boolean(e[1])));
    const ok = await downloadFile(`/api/v1/admin/orders/export${search.size ? `?${search}` : ""}`, "polivalko-orders.csv");
    setExporting(false);
    if (!ok) setBulk({ busy: false, error: true, message: "Не вдалося вивантажити CSV. Спробуйте ще раз." });
  }

  return (
    <>
      <PageHead title="Замовлення" sub="Фільтри зберігаються в адресі сторінки — вибірку можна надіслати колезі.">
        <button type="button" className="btn btn--quiet" onClick={exportCsv} disabled={exporting} aria-busy={exporting}>
          <DownloadIcon />
          {exporting ? "Готуємо…" : "Експорт CSV"}
        </button>
      </PageHead>

      <nav className="admin-tabs" aria-label="Статус замовлення">
        <button type="button" aria-pressed={!f.status} onClick={() => go({ status: "" })}>
          Усі <span className="tab-count">{counts.data?.all ?? "·"}</span>
        </button>
        {(Object.keys(orderStatusLabel) as OrderStatus[]).map((s) => {
          const n = countOf(s);
          return (
            <button key={s} type="button" aria-pressed={f.status === s} onClick={() => go({ status: s })}>
              {orderStatusLabel[s]}
              <span className={`tab-count${n > 0 && (s === "new" || s === "awaitingConfirmation") ? " tab-count--hot" : ""}`}>{counts.data ? n : "·"}</span>
            </button>
          );
        })}
      </nav>

      <form
        className="admin-filters"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
      >
        <div className="field field--wide">
          <label htmlFor="q">Пошук</label>
          <span className="input-icon">
            <SearchIcon />
            <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Номер, телефон, ім'я…" autoComplete="off" spellCheck={false} />
          </span>
        </div>
        <div className="field">
          <label htmlFor="paymentStatus">Оплата</label>
          <select id="paymentStatus" value={f.paymentStatus} onChange={(e) => go({ paymentStatus: e.target.value })}>
            <option value="">Будь-яка</option>
            {Object.entries(paymentStatusLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="delivery">Отримання</label>
          <select id="delivery" value={f.delivery} onChange={(e) => go({ delivery: e.target.value })}>
            <option value="">Будь-яке</option>
            {Object.entries(deliveryMethodLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field field--date">
          <label htmlFor="from">Від</label>
          <input id="from" type="date" value={f.from} max={f.to || undefined} onChange={(e) => go({ from: e.target.value })} />
        </div>
        <div className="field field--date">
          <label htmlFor="to">До</label>
          <input id="to" type="date" value={f.to} min={f.from || undefined} onChange={(e) => go({ to: e.target.value })} />
        </div>
        <div className="admin-filters__actions">
          <button type="submit" className="btn">
            Знайти
          </button>
          {filtered && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setText("");
                selection.clear();
                router.replace(pathname, { scroll: false });
              }}
            >
              Скинути
            </button>
          )}
        </div>
      </form>

      {bulk.message && (
        <p className={`notice ${bulk.error ? "notice--error" : "notice--ok"} admin-notice`} role="status">
          {bulk.message}
        </p>
      )}

      <StateBox
        state={orders}
        empty={orders.data?.items.length === 0 ? (filtered ? "За цими умовами замовлень немає." : "Замовлень ще немає.") : undefined}
      >
        {orders.data && (
          <>
            <div className="admin-listbar">
              <p className="admin-count">
                Знайдено: {orders.data.totalItems}
              </p>
              <div className="admin-listbar__sort">
                <label className="admin-count" htmlFor="sort">
                  Порядок
                </label>
                <select id="sort" className="select" value={f.sort || "newest"} onChange={(e) => go({ sort: e.target.value === "newest" ? "" : e.target.value })}>
                  {Object.entries(sortLabel).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <OrdersTable orders={orders.data.items} selection={selection} />
            <Pager page={page} totalPages={orders.data.totalPages} totalItems={orders.data.totalItems} pageSize={PAGE_SIZE} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </StateBox>

      {selection.selected.size > 0 && (
        <div className="bulk-bar" role="region" aria-label="Дії з вибраними замовленнями">
          <span className="bulk-bar__count">
            <b>{selection.selected.size}</b>вибрано
          </span>
          <label className="visually-hidden" htmlFor="bulk-status">
            Новий статус
          </label>
          <select id="bulk-status" className="select" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}>
            <option value="">Змінити статус на…</option>
            {(Object.keys(orderStatusLabel) as OrderStatus[])
              .filter((s) => s !== "new")
              .map((s) => (
                <option key={s} value={s}>
                  {orderStatusLabel[s]}
                </option>
              ))}
          </select>
          <button type="button" className="btn btn--small btn--accent" disabled={!bulkStatus || bulk.busy} aria-busy={bulk.busy} onClick={applyBulk}>
            {bulk.busy ? "Змінюємо…" : "Застосувати"}
          </button>
          <button type="button" className="btn btn--small btn--ghost" onClick={selection.clear}>
            Зняти вибір
          </button>
        </div>
      )}
    </>
  );
}
