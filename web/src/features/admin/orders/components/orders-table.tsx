"use client";

import Link from "next/link";
import { CheckAll, type Selection } from "@/shared/admin/ui/selection";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import { deliveryMethodLabel } from "@/shared/lib/labels";
import type { OrderRow } from "../lib/types";
import { PaymentStatusText, StatusText } from "./status-text";

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
