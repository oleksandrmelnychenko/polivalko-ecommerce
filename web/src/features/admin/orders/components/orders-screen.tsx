"use client";

import { Suspense, useState } from "react";
import { useSummary } from "@/features/admin/shell";
import { withCsrf } from "@/shared/admin/csrf";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { PageHead } from "@/shared/admin/ui/page-head";
import { Pager } from "@/shared/admin/ui/pager";
import { useSelection } from "@/shared/admin/ui/selection";
import { StateBox } from "@/shared/admin/ui/state-box";
import { problemTitle } from "@/shared/api/problem";
import type { OrderStatus } from "@/shared/api/types";
import { orderStatusLabel } from "@/shared/lib/labels";
import { DownloadIcon } from "@/shared/ui/icons";
import { changeOrderStatus, exportOrders, getOrderCounts, getOrders } from "../api/client";
import { useOrdersQuery } from "../hooks/use-orders-query";
import { PAGE_SIZE } from "../lib/order-filters";
import { OrdersBulkBar } from "./orders-bulk-bar";
import { OrdersFilters } from "./orders-filters";
import { OrdersListbar } from "./orders-listbar";
import { OrdersStatusTabs } from "./orders-status-tabs";
import { OrdersTable } from "./orders-table";

export function OrdersScreen() {
  return (
    <Suspense fallback={null}>
      <Orders />
    </Suspense>
  );
}

function Orders() {
  const selection = useSelection();
  const { f, page, query, key, go, reset, filtered } = useOrdersQuery(selection);
  const { reload: reloadSummary } = useSummary();
  const [bulkStatus, setBulkStatus] = useState<OrderStatus | "">("");
  const [bulk, setBulk] = useState<{ busy: boolean; message?: string; error?: boolean }>({ busy: false });
  const [exporting, setExporting] = useState(false);

  const orders = useAdminData(`${key}|${page}`, () => getOrders({ ...query, page, pageSize: PAGE_SIZE }));
  const counts = useAdminData(`counts|${f.q}|${f.paymentStatus}|${f.delivery}|${f.from}|${f.to}`, () =>
    getOrderCounts({ q: query.q, paymentStatus: query.paymentStatus, delivery: query.delivery, from: query.from, to: query.to }),
  );

  async function applyBulk() {
    if (!bulkStatus) return;
    const numbers = [...selection.selected];
    setBulk({ busy: true });
    let done = 0;
    const failed: string[] = [];
    for (const number of numbers) {
      const result = await withCsrf((headers) => changeOrderStatus(headers, number, { status: bulkStatus, reason: "Масова зміна статусу" }));
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
    const ok = await exportOrders(search);
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

      <OrdersStatusTabs status={f.status} counts={counts.data} onStatus={(status) => go({ status })} />

      <OrdersFilters f={f} filtered={filtered} go={go} reset={reset} />

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
            <OrdersListbar totalItems={orders.data.totalItems} sort={f.sort} onSort={(sort) => go({ sort })} />
            <OrdersTable orders={orders.data.items} selection={selection} />
            <Pager page={page} totalPages={orders.data.totalPages} totalItems={orders.data.totalItems} pageSize={PAGE_SIZE} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </StateBox>

      {selection.selected.size > 0 && (
        <OrdersBulkBar selection={selection} status={bulkStatus} busy={bulk.busy} onStatus={setBulkStatus} onApply={applyBulk} />
      )}
    </>
  );
}
