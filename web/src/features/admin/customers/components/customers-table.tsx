import Link from "next/link";
import type { components } from "@/shared/api/schema";
import { formatDateTime, formatMoney, plural } from "@/shared/lib/format";
import { initials } from "../lib/initials";

type Customer = components["schemas"]["AdminCustomerDto"];

export function CustomersTable({ customers }: { customers: Customer[] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col">Покупець</th>
            <th scope="col">Телефон</th>
            <th scope="col" className="num">
              Замовлень
            </th>
            <th scope="col" className="num">
              Сума покупок
            </th>
            <th scope="col">Перше</th>
            <th scope="col">Останнє</th>
            <th scope="col" className="col-actions">
              <span className="visually-hidden">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {customers.map((c) => (
            <tr key={c.phone}>
              <td>
                <span className="cell-main">
                  <span className="admin-avatar" aria-hidden="true" style={{ background: "#efefef" }}>
                    {initials(c.name)}
                  </span>
                  <span>
                    <span className="cell-strong">{c.name}</span>
                    <span className="cell-sub">{c.email ?? "без email"}</span>
                  </span>
                </span>
              </td>
              <td>
                <a className="link" href={`tel:${c.phone}`}>
                  {c.phone}
                </a>
              </td>
              <td className="num">
                {c.orders > 1 ? <span className="chip chip--green">{c.orders} · постійний</span> : c.orders}
              </td>
              <td className="num cell-strong">{formatMoney(c.totalSpent)}</td>
              <td>{formatDateTime(c.firstOrderAt)}</td>
              <td>
                <Link href={`/admin/orders/${c.lastOrderNumber}`} className="code">
                  {c.lastOrderNumber}
                </Link>
                <span className="cell-sub">{formatDateTime(c.lastOrderAt)}</span>
              </td>
              <td className="col-actions">
                <Link href={`/admin/orders?q=${encodeURIComponent(c.phone)}`} className="btn btn--small btn--quiet">
                  {c.orders} {plural(c.orders, "замовлення", "замовлення", "замовлень")}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
