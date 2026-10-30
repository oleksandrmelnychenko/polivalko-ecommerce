"use client";

import Link from "next/link";
import { Fragment, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, TrendUpIcon } from "@/components/icons";
import type { components } from "@/lib/api/schema";
import { formatDateTime, formatMoney } from "@/lib/format";
import { deliveryMethodLabel, orderStatusLabel, paymentStatusLabel } from "@/lib/labels";

type OrderRow = components["schemas"]["AdminOrderListItemDto"];

/** Чотири стани області з даними: завантаження, помилка, порожньо, дані. Під час перезапиту дані лишаються, приглушені. */
export function StateBox({
  state,
  empty,
  skeletonHeight = "var(--space-4xl)",
  children,
}: {
  state: { status: "loading" | "error" | "ready"; reload: () => void; pending?: boolean };
  empty?: string;
  skeletonHeight?: string;
  children: ReactNode;
}) {
  if (state.status === "loading") return <div className="skeleton" style={{ height: skeletonHeight }} aria-busy="true" />;
  if (state.status === "error")
    return (
      <div className="notice notice--error" role="alert">
        <strong>Не вдалося завантажити дані</strong>
        Перевірте, що API працює, і спробуйте ще раз.{" "}
        <button type="button" className="remove" onClick={state.reload}>
          Повторити
        </button>
      </div>
    );
  if (empty) return <div className="empty"><p>{empty}</p></div>;
  return state.pending ? (
    <div className="is-stale" aria-busy="true">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}

/** Заголовок сторінки: назва з жовтою рискою, підпис і дії праворуч. */
export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="admin-head">
      <div className="admin-head__text">
        <h1 className="admin-title">{title}</h1>
        {sub && <p className="admin-head__sub">{sub}</p>}
      </div>
      {children && <div className="admin-head__actions">{children}</div>}
    </div>
  );
}

/**
 * Модальне вікно на нативному <dialog>: Esc і клік по фону закривають, фокус стає на перше поле, а після
 * закриття браузер повертає його на кнопку, що відкрила вікно. Вміст монтується лише відкритим — форма щоразу чиста.
 */
export function Modal({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>(".modal__body :is(input, select, textarea)")?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);
  return (
    <dialog ref={dialog} className="modal" aria-labelledby={titleId} onClose={onClose} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal__head">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="modal__close" onClick={onClose} aria-label="Закрити">
          <CloseIcon />
        </button>
      </div>
      <div className="modal__body">{open && children}</div>
    </dialog>
  );
}

/** Колір статусу як стрічки вітрини: жовтий — потребує дії, блакитний — чекає, зелений — гроші й видача, рожевий — скасування. */
export const statusTone: Record<OrderRow["status"], string> = {
  new: "yellow",
  awaitingConfirmation: "yellow",
  confirmed: "cyan",
  awaitingPayment: "cyan",
  paid: "green",
  shipped: "dark",
  readyForPickup: "green",
  completed: "grey",
  cancelled: "pink",
};

const paymentTone: Record<OrderRow["paymentStatus"], string> = {
  notRequired: "outline",
  pending: "cyan",
  succeeded: "green",
  failed: "pink",
  partiallyRefunded: "yellow",
  refunded: "grey",
};

export function StatusText({ status }: { status: OrderRow["status"] }) {
  return <span className={`chip chip--${statusTone[status]}`}>{orderStatusLabel[status]}</span>;
}

export function PaymentStatusText({ status }: { status: OrderRow["paymentStatus"] }) {
  return <span className={`chip chip--${paymentTone[status]}`}>{paymentStatusLabel[status]}</span>;
}

/** Залишок: нуль — рожевий «Немає», до трьох — жовтий «Мало». */
export const LOW_STOCK = 3;
export function StockText({ stock }: { stock: number }) {
  if (stock <= 0) return <span className="chip chip--pink">Немає</span>;
  if (stock <= LOW_STOCK) return <span className="chip chip--yellow">Мало · {stock}</span>;
  return <>{stock}</>;
}

/** Зміна до попереднього періоду у відсотках; для скасувань зростання — погано (`inverse`). */
export function Delta({ current, previous, inverse = false }: { current: number; previous: number; inverse?: boolean }) {
  if (previous === 0) {
    return current === 0 ? <span className="delta delta--flat">0%</span> : <span className="delta delta--flat">нове</span>;
  }
  const change = ((current - previous) / previous) * 100;
  const rounded = Math.abs(change) < 10 ? Math.round(change * 10) / 10 : Math.round(change);
  if (rounded === 0) return <span className="delta delta--flat">0%</span>;
  const good = inverse ? rounded < 0 : rounded > 0;
  return (
    <span className={`delta ${good ? "delta--up" : "delta--down"}`}>
      <TrendUpIcon />
      {rounded > 0 ? "+" : "−"}
      {Math.abs(rounded).toLocaleString("uk-UA")}%
    </span>
  );
}

/** Сторінки: «Показано 21–40 з 132», стрілки й номери з пропусками. */
export function Pager({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  if (totalItems === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalItems);
  const numbers = Array.from({ length: totalPages }, (_, i) => i + 1).filter((n) => n === 1 || n === totalPages || Math.abs(n - page) <= 1);
  return (
    <nav className="admin-pager" aria-label="Сторінки">
      <p className="admin-count">
        Показано {from}–{to} з {totalItems}
      </p>
      {totalPages > 1 && (
        <div className="admin-pager__pages">
          <button type="button" onClick={() => onPage(page - 1)} disabled={page <= 1} aria-label="Попередня сторінка">
            <ChevronLeftIcon />
          </button>
          {numbers.map((n, i) => (
            <Fragment key={n}>
              {i > 0 && n - numbers[i - 1] > 1 && (
                <span className="gap" aria-hidden="true">
                  …
                </span>
              )}
              {n === page ? (
                <span aria-current="page">{n}</span>
              ) : (
                <button type="button" onClick={() => onPage(n)}>
                  {n}
                </button>
              )}
            </Fragment>
          ))}
          <button type="button" onClick={() => onPage(page + 1)} disabled={page >= totalPages} aria-label="Наступна сторінка">
            <ChevronRightIcon />
          </button>
        </div>
      )}
    </nav>
  );
}

/** Вибір рядків для масових дій. */
export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return {
    selected,
    has: (key: string) => selected.has(key),
    toggle: (key: string) =>
      setSelected((s) => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    setAll: (keys: string[], on: boolean) =>
      setSelected((s) => {
        const next = new Set(s);
        keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
        return next;
      }),
    clear: () => setSelected(new Set()),
  };
}
export type Selection = ReturnType<typeof useSelection>;

/** Прапорець «усі на сторінці»: частковий вибір показує риску. */
export function CheckAll({ keys, selection, label }: { keys: string[]; selection: Selection; label: string }) {
  const count = keys.filter((k) => selection.has(k)).length;
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={keys.length > 0 && count === keys.length}
      ref={(el) => {
        if (el) el.indeterminate = count > 0 && count < keys.length;
      }}
      onChange={(e) => selection.setAll(keys, e.target.checked)}
    />
  );
}

/** Завантаження файлу з API адмінки (cookie входу йдуть разом із запитом того самого сайту). */
export async function downloadFile(url: string, fallbackName: string): Promise<boolean> {
  const response = await fetch(url, { credentials: "same-origin" });
  if (!response.ok) return false;
  const name = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(response.headers.get("content-disposition") ?? "")?.[1];
  const href = URL.createObjectURL(await response.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = name ? decodeURIComponent(name) : fallbackName;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
  return true;
}

export function OrdersTable({ orders, selection }: { orders: OrderRow[]; selection?: Selection }) {
  const keys = orders.map((o) => o.number);
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {selection && (
              <th scope="col" className="col-check">
                <CheckAll keys={keys} selection={selection} label="Вибрати всі замовлення на сторінці" />
              </th>
            )}
            <th scope="col">Замовлення</th>
            <th scope="col">Покупець</th>
            <th scope="col" className="num">
              Сума
            </th>
            <th scope="col">Статус</th>
            <th scope="col">Оплата</th>
            <th scope="col">Отримання</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.number} data-selected={selection?.has(o.number) || undefined}>
              {selection && (
                <td className="col-check">
                  <input type="checkbox" aria-label={`Вибрати ${o.number}`} checked={selection.has(o.number)} onChange={() => selection.toggle(o.number)} />
                </td>
              )}
              <td>
                <Link href={`/admin/orders/${o.number}`} className="code">
                  {o.number}
                </Link>
                <span className="cell-sub">{formatDateTime(o.createdAt)}</span>
              </td>
              <td>
                <span className="cell-strong">{o.customerName}</span>
                <span className="cell-sub">{o.phone}</span>
              </td>
              <td className="num">
                <span className="cell-strong">{formatMoney(o.total)}</span>
                <span className="cell-sub">{o.itemsCount} поз.</span>
              </td>
              <td>
                <StatusText status={o.status} />
              </td>
              <td>
                <PaymentStatusText status={o.paymentStatus} />
              </td>
              <td>{deliveryMethodLabel[o.deliveryMethod] ?? o.deliveryMethod}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
