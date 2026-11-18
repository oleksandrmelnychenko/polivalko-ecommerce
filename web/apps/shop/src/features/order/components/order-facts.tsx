import type { ReactNode } from "react";
import type { Order } from "@polivalko/shared/api/types";
import { deliveryMethodLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";
import { StoreIcon, TruckIcon, UserIcon, WalletIcon } from "@polivalko/shared/ui/icons";

const PENDING_SELLER = /уточнюється/i;

export function OrderFacts({ order, where }: { order: Order; where: string }) {
  const rows: { label: string; icon: ReactNode; value: string; sub?: string }[] = [
    {
      label: "Отримання",
      icon: order.deliveryMethod === "pickup" ? <StoreIcon /> : <TruckIcon />,
      value: deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod,
      sub: where || undefined,
    },
    {
      label: "Оплата",
      icon: <WalletIcon />,
      value: paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod,
      sub: paymentStatusLabel[order.paymentStatus],
    },
    { label: "Покупець", icon: <UserIcon />, value: order.customer.name, sub: [order.customer.phone, order.customer.email].filter(Boolean).join(" · ") },
  ];
  if (order.sellerName && !PENDING_SELLER.test(order.sellerName)) {
    rows.push({ label: "Продавець", icon: <StoreIcon />, value: order.sellerName });
  }

  return (
    <section className="order-card order-facts" aria-labelledby="order-facts-title">
      <h2 id="order-facts-title">Деталі</h2>
      <dl>
        {rows.map((row) => (
          <div key={row.label}>
            <span className="order-facts__icon" aria-hidden="true">
              {row.icon}
            </span>
            <dt>{row.label}</dt>
            <dd>
              <span className="order-facts__value">{row.value}</span>
              {row.sub && <span className="order-facts__sub">{row.sub}</span>}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
