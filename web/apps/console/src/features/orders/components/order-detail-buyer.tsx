import { deliveryMethodLabel, paymentMethodLabel } from "@polivalko/shared/lib/labels";
import type { ConsoleOrder } from "../lib/types";

export function OrderDetailBuyer({ order: o }: { order: ConsoleOrder }) {
  return (
    <section className="console-card" aria-labelledby="buyer-title">
      <div className="console-card__head">
        <h2 id="buyer-title">Покупець</h2>
      </div>
      <div className="console-card__body">
        <dl className="buybox__meta">
          <dt>Ім&apos;я</dt>
          <dd>
            <strong>{o.customerName}</strong>
          </dd>
          <dt>Телефон</dt>
          <dd>
            <a className="link" href={`tel:${o.phone}`}>
              {o.phone}
            </a>
          </dd>
          {o.email && (
            <>
              <dt>Email</dt>
              <dd>
                <a className="link" href={`mailto:${o.email}`}>
                  {o.email}
                </a>
              </dd>
            </>
          )}
          <dt>Отримання</dt>
          <dd>
            {deliveryMethodLabel[o.deliveryMethod] ?? o.deliveryMethod}
            {o.settlementName && `: ${o.settlementName}`}
            {o.warehouseName && `, ${o.warehouseName}`}
            {o.deliveryAddress && `, ${o.deliveryAddress}`}
            {o.pickupAddress && `: ${o.pickupAddress}`}
          </dd>
          <dt>Оплата</dt>
          <dd>{paymentMethodLabel[o.paymentMethod] ?? o.paymentMethod}</dd>
          {o.comment && (
            <>
              <dt>Коментар</dt>
              <dd>{o.comment}</dd>
            </>
          )}
        </dl>
      </div>
    </section>
  );
}
