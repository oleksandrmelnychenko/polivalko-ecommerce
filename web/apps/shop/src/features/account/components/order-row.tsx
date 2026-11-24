import Link from "next/link";
import type { components } from "@polivalko/shared/api/schema";
import { countProducts, formatDateTime, formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";
import { ClipboardIcon } from "@polivalko/shared/ui/icons";
import { orderStatusLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";
import { orderTone } from "../lib/order-tone";

type AccountOrder = components["schemas"]["AccountOrderListItemDto"];

export function OrderRow({ order }: { order: AccountOrder }) {
  return (
    <tr className="order-row">
      <td>
        <div className="order-row__product">
          <span className="line__photo">
            {order.mainItemImageUrl ? <img src={thumb(order.mainItemImageUrl)} alt="" width={52} height={52} loading="lazy" /> : <ClipboardIcon />}
          </span>
          <div className="order-row__info">
            <p className="order-row__title">
              <Link href={`/account/orders/${order.number}`}>
                <span className="code">{order.number}</span>
              </Link>
            </p>
            <p className="order-row__item">{order.mainItemName}</p>
            <p className="order-row__meta">
              <time dateTime={order.createdAt}>{formatDateTime(order.createdAt)}</time>
              <span>{countProducts(order.itemCount)}</span>
            </p>
          </div>
        </div>
      </td>
      <td><span className={`status-chip status-chip--${orderTone(order.status)}`}>{orderStatusLabel[order.status]}</span></td>
      <td>
        <span className={order.canPay ? "order-row__pay order-row__pay--due" : "order-row__pay"}>
          {order.canPay ? "Можна оплатити онлайн" : `${paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod}, ${paymentStatusLabel[order.paymentStatus].toLowerCase()}`}
        </span>
      </td>
      <td className="order-row__total"><strong className="money">{formatMoney(order.total)}</strong></td>
    </tr>
  );
}
