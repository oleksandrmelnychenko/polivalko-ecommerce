"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { browserApi } from "@/lib/api/browser";
import { useAdminData } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { StateBox } from "../ui";
import { AdminOnly } from "../content/_lib";

const PAGE_SIZE = 30;

const entityTypeLabel: Record<string, string> = {
  Order: "Замовлення",
  Product: "Товар",
  Category: "Категорія",
  Collection: "Добірка",
  Redirect: "Перенаправлення",
  Page: "Сторінка",
  Contacts: "Контакти",
  ServiceDirection: "Напрямок послуг",
  PickupPoint: "Точка самовивозу",
  StaffUser: "Працівник",
  SyncJob: "Фонове завдання",
  OutboxMessage: "Операція черги",
  CatalogImport: "Імпорт каталогу",
};

const actionLabel: Record<string, string> = {
  "order.status_changed": "Змінено статус замовлення",
  "order.refund_created": "Оформлено повернення коштів",
  "catalog.product_updated": "Змінено товар",
  "catalog.product_image_added": "Додано фото товару",
  "catalog.product_image_deleted": "Видалено фото товару",
  "catalog.category_created": "Створено категорію",
  "catalog.category_updated": "Змінено категорію",
  "catalog.category_deleted": "Видалено категорію",
  "catalog.collection_created": "Створено добірку",
  "catalog.collection_updated": "Змінено добірку",
  "catalog.collection_deleted": "Видалено добірку",
  "catalog.redirect_created": "Додано перенаправлення",
  "catalog.redirect_deleted": "Видалено перенаправлення",
  "catalog.imported": "Імпортовано каталог з файлу",
  "content.page_updated": "Змінено текстову сторінку",
  "content.contacts_updated": "Змінено контакти",
  "content.service_direction_updated": "Змінено напрямок послуг",
  "delivery.pickup_point_updated": "Змінено точку самовивозу",
  "integration.job_requested": "Запущено завдання поза розкладом",
  "integration.outbox_retried": "Повторено операцію черги",
  "user.created": "Додано працівника",
  "user.updated": "Змінено ім'я або роль працівника",
  "user.locked": "Заблоковано доступ працівника",
  "user.unlocked": "Відновлено доступ працівника",
  "user.password_reset": "Адміністратор змінив пароль працівника",
  "user.password_changed": "Працівник змінив власний пароль",
};

/** Записи, що мають свою сторінку в адмінці. */
const entityHref: Record<string, (id: string) => string> = {
  Order: (id) => `/admin/orders/${encodeURIComponent(id)}`,
  Page: (id) => `/admin/content/pages/${encodeURIComponent(id)}`,
};

export default function AdminAuditPage() {
  return (
    <AdminOnly title="Журнал змін">
      <Suspense fallback={null}>
        <Audit />
      </Suspense>
    </AdminOnly>
  );
}

function Audit() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const entityType = params.get("entityType") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const [text, setText] = useState(q);

  const audit = useAdminData(`${entityType}|${q}|${page}`, () =>
    browserApi.GET("/api/v1/admin/audit", {
      params: { query: { entityType: entityType || undefined, q: q || undefined, page, pageSize: PAGE_SIZE } },
    }),
  );

  // Фільтри в URL, як у замовленнях: вибірку можна надіслати іншому адміністратору.
  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  };

  const data = audit.data;

  return (
    <>
      <h1 className="admin-title">Журнал змін</h1>
      <form
        className="admin-filters"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
      >
        <div className="field">
          <label htmlFor="entityType">Об&apos;єкт</label>
          <select id="entityType" value={entityType} onChange={(e) => go({ entityType: e.target.value })}>
            <option value="">Усі</option>
            {Object.entries(entityTypeLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="q">Пошук</label>
          <input id="q" value={text} onChange={(e) => setText(e.target.value)} placeholder="PV-100001, ім'я або user.locked" aria-describedby="q-help" />
        </div>
        <button type="submit" className="btn btn--small btn--quiet">
          Знайти
        </button>
        <p id="q-help" className="field__help admin-filters__note">
          Пошук: точний номер чи код об&apos;єкта, ім&apos;я працівника або частина коду дії.
        </p>
      </form>

      <StateBox state={audit} empty={data?.items.length === 0 ? (q || entityType ? "За цими умовами записів немає." : "Журнал порожній.") : undefined}>
        {data && (
          <>
            <p className="muted admin-count">Записів: {data.totalItems}</p>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Коли</th>
                    <th scope="col">Хто</th>
                    <th scope="col">Дія</th>
                    <th scope="col">Об&apos;єкт</th>
                    <th scope="col">Деталі</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((a) => {
                    const href = a.entityId ? entityHref[a.entityType]?.(a.entityId) : undefined;
                    return (
                      <tr key={a.id}>
                        <td className="admin-nowrap">{formatDateTime(a.at)}</td>
                        <td>{a.actor}</td>
                        <td>
                          {actionLabel[a.action] ?? a.action}
                          {actionLabel[a.action] && (
                            <>
                              <br />
                              <span className="muted admin-small">{a.action}</span>
                            </>
                          )}
                        </td>
                        <td>
                          {entityTypeLabel[a.entityType] ?? a.entityType}
                          {a.entityId && (
                            <>
                              <br />
                              {href ? (
                                <Link href={href} className="code">
                                  {a.entityId}
                                </Link>
                              ) : (
                                <span className="code">{a.entityId}</span>
                              )}
                            </>
                          )}
                        </td>
                        <td>
                          {a.details == null ? (
                            <span className="muted">немає</span>
                          ) : (
                            <details className="admin-details">
                              <summary>JSON</summary>
                              <pre className="admin-pre">{JSON.stringify(a.details, null, 2)}</pre>
                            </details>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {data.totalPages > 1 && (
              <nav className="pager admin-pager" aria-label="Сторінки журналу">
                <button type="button" className="pager__btn" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
                  Новіші
                </button>
                <span aria-current="page">
                  {page} з {data.totalPages}
                </span>
                <button type="button" className="pager__btn" disabled={page >= data.totalPages} onClick={() => go({ page: String(page + 1) })}>
                  Старіші
                </button>
              </nav>
            )}
          </>
        )}
      </StateBox>
    </>
  );
}
