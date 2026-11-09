import Link from "next/link";
import type { components } from "@polivalko/shared/api/schema";
import { countProducts, formatDateTime, formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";
import { orderTone } from "../lib/order-tone";

type AccountOrder = components["schemas"]["AccountOrderListItemDto"];

export function OrderRow({ order }: { order: AccountOrder }) {
  return (
    <li className="order-row">
      <span className="line__photo">
        {order.mainItemImageUrl && <img src={thumb(order.mainItemImageUrl)} alt="" width={76} height={76} loading="lazy" />}
      </span>
      <div className="order-row__info">
        <p className="order-row__title">
          <Link href={`/account/orders/${order.number}`}>
            Замовлення <span className="code">{order.number}</span>
          </Link>
        </p>
        <p className="order-row__item">{order.mainItemName}</p>
        <p className="order-row__meta">
          <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
          <span>{countProducts(order.itemCount)}</span>
        </p>
      </div>
      <div className="order-row__side">
        <strong className="order-row__total"><span className="money">{formatMoney(order.total)}</span></strong>
        <span className={`status-chip status-chip--${orderTone(order.status)}`}>{orderStatusLabel[order.status]}</span>
        <span className={order.canPay ? "order-row__pay order-row__pay--due" : "order-row__pay"}>
          {order.canPay ? "Можна оплатити онлайн" : `${paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}, ${paymentStatusLabel[order.paymentStatus].toLowerCase()}`}
        </span>
      </div>
    </li>
  );
}
