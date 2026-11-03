"use client";

import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import { getOrderPayments } from "../api/client";
import { attemptLabel } from "../lib/tones";

export function OrderPayments({ number, version }: { number: string; version: string }) {
  const payments = useAdminData(`payments-${number}-${version}`, () => getOrderPayments(number));
  return (
    <section className="admin-subsection" aria-labelledby="payments-title">
      <h2 id="payments-title">Онлайн-оплата</h2>
      <StateBox state={payments} empty={payments.data?.length === 0 ? "Спроб онлайн-оплати не було." : undefined}>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Створено</th>
                <th scope="col">Провайдер</th>
                <th scope="col">Стан</th>
                <th scope="col" className="num">
                  Сума
                </th>
                <th scope="col">Повідомлень</th>
              </tr>
            </thead>
            <tbody>
              {payments.data?.map((p) => (
                <tr key={p.id}>
                  <td>{formatDateTime(p.createdAt)}</td>
                  <td>
                    {p.provider}
                    <br />
                    <span className="muted code">{p.providerPaymentId}</span>
                  </td>
                  <td>
                    <span className={p.status === "succeeded" ? "badge badge--ok" : p.status === "failed" ? "badge badge--bad" : "badge"}>
                      {attemptLabel[p.status] ?? p.status}
                    </span>
                    {p.failureReason && (
                      <>
                        <br />
                        <span className="muted">{p.failureReason}</span>
                      </>
                    )}
                  </td>
                  <td className="num">{formatMoney(p.amount)}</td>
                  <td className="num">{p.eventsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBox>
    </section>
  );
}
