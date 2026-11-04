"use client";

import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { formatDateTime, formatMoney } from "@polivalko/shared/lib/format";
import { receiptKindLabel } from "@polivalko/shared/lib/labels";
import { getOrderReceipts } from "../api/client";

export function OrderReceipts({ number, version }: { number: string; version: string }) {
  const receipts = useConsoleData(`receipts-${number}-${version}`, () => getOrderReceipts(number));
  return (
    <section className="console-subsection" aria-labelledby="receipts-title">
      <h2 id="receipts-title">Фіскальні чеки</h2>
      <StateBox state={receipts} empty={receipts.data?.length === 0 ? "Чеків ще немає: їх видає ПРРО за погодженими правилами." : undefined}>
        <div className="console-table-wrap">
          <table className="console-table">
            <thead>
              <tr>
                <th scope="col">Чек</th>
                <th scope="col">Фіскальний номер</th>
                <th scope="col" className="num">
                  Сума
                </th>
                <th scope="col">Стан</th>
              </tr>
            </thead>
            <tbody>
              {receipts.data?.map((r) => (
                <tr key={r.id}>
                  <td>
                    {receiptKindLabel[r.kind] ?? r.kind}
                    <br />
                    <span className="muted">
                      {r.provider}, {r.paymentType === "CASH" ? "готівка" : "безготівково"}
                    </span>
                  </td>
                  <td>
                    {r.fiscalCode ? (
                      r.url ? (
                        <a href={r.url} className="link code" target="_blank" rel="noopener">
                          {r.fiscalCode}
                        </a>
                      ) : (
                        <span className="code">{r.fiscalCode}</span>
                      )
                    ) : (
                      "ще немає"
                    )}
                  </td>
                  <td className="num">{formatMoney(r.amount)}</td>
                  <td>
                    {r.status === "issued" ? `Видано ${r.issuedAt ? formatDateTime(r.issuedAt) : ""}` : r.status === "pending" ? "Видається" : "Помилка"}
                    {r.error && (
                      <>
                        <br />
                        <span className="muted">{r.error}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StateBox>
    </section>
  );
}
