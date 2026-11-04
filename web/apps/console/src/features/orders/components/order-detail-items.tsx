import { siteUrl } from "@/shared/site-url";
import { formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";
import type { ConsoleOrder } from "../lib/types";

export function OrderDetailItems({ order: o }: { order: ConsoleOrder }) {
  return (
    <section className="console-card" aria-labelledby="items-title">
      <div className="console-card__head">
        <h2 id="items-title">Склад</h2>
        <span className="muted">
          {o.items.reduce((s, i) => s + i.quantity, 0)} шт. · {o.items.length} поз.
        </span>
      </div>
      <div className="console-table-wrap">
        <table className="console-table">
          <thead>
            <tr>
              <th scope="col">Товар</th>
              <th scope="col" className="num">
                Ціна
              </th>
              <th scope="col" className="num">
                Кількість
              </th>
              <th scope="col" className="num">
                Сума
              </th>
            </tr>
          </thead>
          <tbody>
            {o.items.map((i) => (
              <tr key={i.productId}>
                <td>
                  <span className="cell-main">
                    {i.imageUrl ? <img className="console-thumb" src={thumb(i.imageUrl, 120)} alt="" loading="lazy" /> : <span className="console-thumb" />}
                    <span>
                      <a href={siteUrl(`/product/${i.slug}`)} className="cell-strong" target="_blank" rel="noopener" style={{ textDecoration: "none" }}>
                        {i.name}
                      </a>
                      <span className="cell-sub code">{i.sku}</span>
                    </span>
                  </span>
                </td>
                <td className="num">{formatMoney(i.unitPrice)}</td>
                <td className="num">× {i.quantity}</td>
                <td className="num cell-strong">{formatMoney(i.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Разом до сплати
              </th>
              <td className="num">
                <strong style={{ fontSize: "1.0625rem" }}>{formatMoney(o.total)}</strong>
              </td>
            </tr>
            {Number(o.refundedAmount.value) > 0 && (
              <tr>
                <th scope="row" colSpan={3}>
                  Повернено
                </th>
                <td className="num">−{formatMoney(o.refundedAmount)}</td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </section>
  );
}
