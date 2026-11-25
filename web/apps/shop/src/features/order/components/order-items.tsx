import Link from "next/link";
import type { Order } from "@polivalko/shared/api/types";
import { countProducts, formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@/shared/lib/images";

export function OrderItems({ order }: { order: Order }) {
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <section className="order-card order-items" aria-labelledby="items-title">
      <div className="order-card__head">
        <h2 id="items-title">Склад замовлення</h2>
        <span className="order-card__meta">{countProducts(pieces)}</span>
      </div>
      <ul className="order-items__list">
        {order.items.map((item) => (
          <li key={item.productId} className="line">
            <span className="line__photo">{item.imageUrl && <img src={thumb(item.imageUrl)} alt="" width={76} height={76} loading="lazy" />}</span>
            <div>
              <p className="line__name">
                <Link href={`/product/${item.slug}`}>{item.name}</Link>
              </p>
              <p className="order-items__meta">
                <span className="code" translate="no">
                  {item.sku}
                </span>
                <span>
                  {item.quantity} шт. × <span className="money">{formatMoney(item.unitPrice)}</span>
                </span>
              </p>
            </div>
            <p className="line__total">
              <span className="money">{formatMoney(item.lineTotal)}</span>
            </p>
          </li>
        ))}
      </ul>
      <dl className="totals order-items__totals">
        <dt>Товари</dt>
        <dd>
          <span className="money">{formatMoney(order.subtotal)}</span>
        </dd>
        <dt>Доставка</dt>
        <dd>{order.deliveryMethod === "pickup" ? "безкоштовно" : "за тарифами перевізника"}</dd>
        {Number(order.refundedAmount.value) > 0 && (
          <>
            <dt>Повернено</dt>
            <dd>
              <span className="money">{formatMoney(order.refundedAmount)}</span>
            </dd>
          </>
        )}
        <dt className="grand">Разом за товари</dt>
        <dd className="grand">
          <span className="money">{formatMoney(order.total)}</span>
        </dd>
      </dl>
    </section>
  );
}
