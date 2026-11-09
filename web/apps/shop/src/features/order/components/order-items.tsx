import Link from "next/link";
import type { Order } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";

export function OrderItems({ order }: { order: Order }) {
  return (
    <section aria-labelledby="items-title">
      <h2 id="items-title">Склад замовлення</h2>
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {order.items.map((item) => (
          <li key={item.productId} className="line">
            <span className="line__photo">{item.imageUrl && <img src={thumb(item.imageUrl)} alt="" width={56} height={56} loading="lazy" />}</span>
            <div>
              <p className="line__name">
                <Link href={`/product/${item.slug}`}>{item.name}</Link>
              </p>
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                <span className="code" translate="no">{item.sku}</span>, {item.quantity} шт. по <span className="money">{formatMoney(item.unitPrice)}</span>
              </p>
            </div>
            <p className="line__total"><span className="money">{formatMoney(item.lineTotal)}</span></p>
          </li>
        ))}
      </ul>
      <dl className="totals" style={{ marginTop: "var(--space-lg)" }}>
        <dt>Товари</dt>
        <dd><span className="money">{formatMoney(order.subtotal)}</span></dd>
        <dt>Доставка</dt>
        <dd>{order.deliveryMethod === "pickup" ? "безкоштовно" : "за тарифами перевізника"}</dd>
        {Number(order.refundedAmount.value) > 0 && (
          <>
            <dt>Повернено</dt>
            <dd><span className="money">{formatMoney(order.refundedAmount)}</span></dd>
          </>
        )}
        <dt className="grand">Разом</dt>
        <dd className="grand"><span className="money">{formatMoney(order.total)}</span></dd>
      </dl>
    </section>
  );
}
