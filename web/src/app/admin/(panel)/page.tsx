"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AlertIcon, BagIcon, CheckIcon, ChevronRightIcon, TagIcon, UsersIcon, WalletIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { formatDateTime, formatMoney } from "@/lib/format";
import { deliveryMethodLabel, orderStatusLabel } from "@/lib/labels";
import { useSummary } from "./admin-shell";
import { RevenueChart, type Metric } from "./revenue-chart";
import { Delta, OrdersTable, PageHead, StateBox, StatusText, StockText } from "./ui";

type Dashboard = components["schemas"]["AdminDashboardDto"];
const PERIODS = [7, 30, 90] as const;

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={null}>
      <Overview />
    </Suspense>
  );
}

function Overview() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const days = PERIODS.find((p) => String(p) === params.get("days")) ?? 30;
  const [metric, setMetric] = useState<Metric>("revenue");
  const dashboard = useAdminData(`dashboard|${days}`, () => browserApi.GET("/api/v1/admin/dashboard", { params: { query: { days } } }));
  const latest = useAdminData("latest", () => browserApi.GET("/api/v1/admin/orders", { params: { query: { page: 1, pageSize: 6 } } }));
  const { summary } = useSummary();

  return (
    <>
      <PageHead title="Огляд" sub={`Останні ${days} днів порівняно з попередніми ${days}. Час — київський.`}>
        <div className="seg" role="group" aria-label="Період">
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={p === days} onClick={() => router.replace(p === 30 ? pathname : `${pathname}?days=${p}`, { scroll: false })}>
              {p} днів
            </button>
          ))}
        </div>
      </PageHead>

      {summary && <Health summary={summary} />}
      {summary && <Queue summary={summary} />}

      <StateBox state={dashboard} skeletonHeight="560px">
        {dashboard.data && <Insights data={dashboard.data} metric={metric} onMetric={setMetric} />}
      </StateBox>

      <section className="admin-card" style={{ marginTop: "var(--a-gap)" }} aria-labelledby="latest-title">
        <div className="admin-card__head">
          <h2 id="latest-title">Останні замовлення</h2>
          <Link href="/admin/orders" className="link">
            Усі замовлення
          </Link>
        </div>
        <StateBox state={latest} empty={latest.data?.items.length === 0 ? "Замовлень ще немає. Вони з'являться тут одразу після оформлення на сайті." : undefined}>
          {latest.data && <OrdersTable orders={latest.data.items} />}
        </StateBox>
      </section>
    </>
  );
}

/** Стан, що потребує уваги: застарілі ціни, невиконані операції, повернення в обробці (розділ 7 ТЗ). */
function Health({ summary }: { summary: components["schemas"]["AdminSummaryDto"] }) {
  const issues = [
    !summary.catalogDataFresh &&
      `Ціни й залишки не оновлювалися${summary.lastPriceSync ? ` з ${formatDateTime(summary.lastPriceSync)}` : ""}: нові замовлення приймаються як заявки без онлайн-оплати.`,
    summary.failedOperations > 0 && `Невиконаних фонових операцій: ${summary.failedOperations}.`,
    summary.pendingRefunds > 0 && `Повернень коштів в обробці: ${summary.pendingRefunds}.`,
  ].filter((i): i is string => Boolean(i));

  return (
    <div className="dash-alerts" role="status">
      {issues.length === 0 ? (
        <p className="dash-alert dash-alert--ok">
          <CheckIcon />
          Інтеграції в нормі{summary.lastPriceSync ? `, ціни оновлено ${formatDateTime(summary.lastPriceSync)}` : ""}.
          <Link href="/admin/integration" className="link">
            Інтеграції
          </Link>
        </p>
      ) : (
        issues.map((issue) => (
          <p key={issue} className="dash-alert">
            <AlertIcon />
            {issue}
            <Link href="/admin/integration" className="link">
              Розібратися
            </Link>
          </p>
        ))
      )}
    </div>
  );
}

/** Черга: що треба обробити просто зараз. */
function Queue({ summary }: { summary: components["schemas"]["AdminSummaryDto"] }) {
  const items = [
    { n: summary.newOrders, label: "нових замовлень", href: "/admin/orders?status=new" },
    { n: summary.awaitingConfirmation, label: "чекають підтвердження", href: "/admin/orders?status=awaitingConfirmation" },
    { n: summary.awaitingPayment, label: "чекають оплати", href: "/admin/orders?status=awaitingPayment" },
    { n: summary.newServiceRequests, label: "нових заявок на послуги", href: "/admin/requests?status=new" },
  ];
  return (
    <ul className="dash-queue" aria-label="Черга на обробку">
      {items.map((i) => (
        <li key={i.label}>
          <Link href={i.href} className={i.n > 0 && i.label !== "чекають оплати" ? "is-hot" : undefined}>
            <b>{i.n}</b>
            <span>{i.label}</span>
            <ChevronRightIcon />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function Insights({ data, metric, onMetric }: { data: Dashboard; metric: Metric; onMetric: (m: Metric) => void }) {
  const { current: c, previous: p } = data;
  const kpis = [
    { label: "Виручка", icon: <WalletIcon />, value: formatMoney(c.revenue), delta: <Delta current={Number(c.revenue.value)} previous={Number(p.revenue.value)} />, foot: `було ${formatMoney(p.revenue)}` },
    { label: "Замовлення", icon: <BagIcon />, value: c.orders.toLocaleString("uk-UA"), delta: <Delta current={c.orders} previous={p.orders} />, foot: c.cancelled ? `скасовано ${c.cancelled}` : `було ${p.orders}` },
    { label: "Середній чек", icon: <TagIcon />, value: formatMoney(c.averageOrder), delta: <Delta current={Number(c.averageOrder.value)} previous={Number(p.averageOrder.value)} />, foot: `було ${formatMoney(p.averageOrder)}` },
    { label: "Покупці", icon: <UsersIcon />, value: c.customers.toLocaleString("uk-UA"), delta: <Delta current={c.customers} previous={p.customers} />, foot: `було ${p.customers}` },
  ];
  const statusTotal = data.byStatus.reduce((s, x) => s + x.count, 0);
  const statusMax = Math.max(...data.byStatus.map((s) => s.count), 1);
  const deliveryTotal = data.byDelivery.reduce((s, x) => s + x.count, 0);
  const deliveryMax = Math.max(...data.byDelivery.map((s) => s.count), 1);
  const share = (n: number, total: number) => (total ? `${Math.round((n / total) * 100)}%` : "");

  return (
    <>
      <ul className="dash-kpis">
        {kpis.map((k) => (
          <li key={k.label} className="kpi">
            <span className="kpi__label">
              {k.icon}
              {k.label}
            </span>
            <span className="kpi__value">{k.value}</span>
            <span className="kpi__foot">
              {k.delta}
              <span>{k.foot}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="dash-grid">
        <section className="admin-card" aria-labelledby="chart-title">
          <div className="admin-card__head">
            <h2 id="chart-title">{metric === "revenue" ? "Виручка по днях" : "Замовлення по днях"}</h2>
            <div className="seg" role="group" aria-label="Показник графіка">
              <button type="button" aria-pressed={metric === "revenue"} onClick={() => onMetric("revenue")}>
                Виручка
              </button>
              <button type="button" aria-pressed={metric === "orders"} onClick={() => onMetric("orders")}>
                Замовлення
              </button>
            </div>
          </div>
          <div className="admin-card__body">
            <RevenueChart days={data.byDay} metric={metric} />
          </div>
        </section>

        <div className="dash-side">
          <section className="admin-card" aria-labelledby="status-title">
            <div className="admin-card__head">
              <h2 id="status-title">Статуси</h2>
              <span className="muted">{statusTotal} замовл.</span>
            </div>
            <div className="admin-card__body">
              {data.byStatus.length === 0 ? (
                <p className="muted">Замовлень за період немає.</p>
              ) : (
                <ul className="barlist">
                  {[...data.byStatus]
                    .sort((a, b) => b.count - a.count)
                    .map((s) => (
                      <li key={s.status}>
                        <span className="barlist__name">
                          <Link href={`/admin/orders?status=${s.status}`} aria-label={`${orderStatusLabel[s.status]}: відкрити замовлення`}>
                            <StatusText status={s.status} />
                          </Link>
                        </span>
                        <span className="barlist__value">
                          {s.count}
                          <small>{share(s.count, statusTotal)}</small>
                        </span>
                        <span className="barlist__track" aria-hidden="true">
                          <span className="barlist__fill" style={{ display: "block", width: `${(s.count / statusMax) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>

          <section className="admin-card" aria-labelledby="delivery-title">
            <div className="admin-card__head">
              <h2 id="delivery-title">Отримання</h2>
            </div>
            <div className="admin-card__body">
              {data.byDelivery.length === 0 ? (
                <p className="muted">Замовлень за період немає.</p>
              ) : (
                <ul className="barlist">
                  {[...data.byDelivery]
                    .sort((a, b) => b.count - a.count)
                    .map((d) => (
                      <li key={d.method}>
                        <span className="barlist__name">{deliveryMethodLabel[d.method] ?? d.method}</span>
                        <span className="barlist__value">
                          {d.count}
                          <small>{share(d.count, deliveryTotal)}</small>
                        </span>
                        <span className="barlist__track" aria-hidden="true">
                          <span className="barlist__fill" style={{ display: "block", width: `${(d.count / deliveryMax) * 100}%` }} />
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>

      <div className="dash-grid dash-grid--even">
        <section className="admin-card" aria-labelledby="top-title">
          <div className="admin-card__head">
            <h2 id="top-title">Топ товарів</h2>
            <span className="muted">за виручкою</span>
          </div>
          {data.topProducts.length === 0 ? (
            <p className="rank__empty">Продажів за період немає.</p>
          ) : (
            <ol className="rank">
              {data.topProducts.map((t, i) => (
                <li key={t.productId}>
                  <span className="rank__n">{i + 1}</span>
                  {t.imageUrl ? <img className="admin-thumb" src={t.imageUrl} alt="" loading="lazy" /> : <span className="admin-thumb" />}
                  <span className="rank__main">
                    <Link href={`/admin/catalog/products/${t.productId}`}>{t.name}</Link>
                    <span className="cell-sub">{t.sku}</span>
                  </span>
                  <span className="rank__side">
                    {formatMoney(t.revenue)}
                    <span className="cell-sub">{t.quantity} шт.</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="admin-card" aria-labelledby="stock-title">
          <div className="admin-card__head">
            <h2 id="stock-title">Закінчуються</h2>
            <Link href="/admin/catalog?stock=low" className="link">
              Усі
            </Link>
          </div>
          {data.lowStock.length === 0 ? (
            <p className="rank__empty">Усі товари в достатній кількості.</p>
          ) : (
            <ul className="rank">
              {data.lowStock.map((s) => (
                <li key={s.id}>
                  <span className="rank__main">
                    <Link href={`/admin/catalog/products/${s.id}`}>{s.name}</Link>
                    <span className="cell-sub">{s.sku}</span>
                  </span>
                  <span className="rank__side">
                    <StockText stock={s.stock} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="admin-card" aria-labelledby="period-title">
          <div className="admin-card__head">
            <h2 id="period-title">Підсумок періоду</h2>
          </div>
          <div className="admin-card__body">
            <dl className="buybox__meta">
              <dt>Виручка</dt>
              <dd>
                <strong>{formatMoney(c.revenue)}</strong>
              </dd>
              <dt>Замовлень</dt>
              <dd>{c.orders}</dd>
              <dt>Скасовано</dt>
              <dd>
                {c.cancelled} <Delta current={c.cancelled} previous={p.cancelled} inverse />
              </dd>
              <dt>Середній чек</dt>
              <dd>{formatMoney(c.averageOrder)}</dd>
              <dt>Покупців</dt>
              <dd>{c.customers}</dd>
              <dt>Найкращий день</dt>
              <dd>{bestDay(data)}</dd>
            </dl>
          </div>
        </section>
      </div>
    </>
  );
}

function bestDay(data: Dashboard) {
  const best = data.byDay.reduce<Dashboard["byDay"][number] | null>((b, d) => (Number(d.revenue.value) > Number(b?.revenue.value ?? 0) ? d : b), null);
  if (!best) return "—";
  const date = new Intl.DateTimeFormat("uk-UA", { day: "numeric", month: "long", timeZone: "Europe/Kyiv" }).format(new Date(`${best.date}T12:00:00+03:00`));
  return `${date}, ${formatMoney(best.revenue)}`;
}
