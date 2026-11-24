import type { ReactNode } from "react";
import type { Order, PickupPoint } from "@polivalko/shared/api/types";
import { directionsUrl } from "@/shared/lib/directions-url";
import { deliveryMethodLabel, paymentMethodLabel, paymentStatusLabel } from "@polivalko/shared/lib/labels";
import { StoreIcon, TruckIcon, UserIcon, WalletIcon } from "@polivalko/shared/ui/icons";

const PENDING_SELLER = /уточнюється/i;

function pickupDetails(saved: string, points: PickupPoint[]) {
  // Older orders for Bucha contain a seeded address instead of a street address.
  const legacy = saved.includes("(точну адресу надає замовник)") || saved.includes("(точну адресу надає магазин)");
  const point = legacy
    ? points.find((p) => p.code === "bucha-store")
    : points.find((p) => p.address && (saved === p.address || saved.endsWith(", " + p.address)));
  const address = point?.address || (legacy ? "" : saved);
  return { address, schedule: point?.schedule, route: directionsUrl(point?.mapUrl, address) };
}

export function OrderFacts({ order, where, pickupPoints }: { order: Order; where: string; pickupPoints: PickupPoint[] }) {
  const pickup = order.deliveryMethod === "pickup" ? pickupDetails(where, pickupPoints) : null;
  const rows: { label: string; icon: ReactNode; value: string; sub?: string; extra?: ReactNode }[] = [
    {
      label: "Отримання",
      icon: order.deliveryMethod === "pickup" ? <StoreIcon /> :
        ["nova_poshta", "nova_poshta_courier"].includes(order.deliveryMethod) ?
          <img className="np-mark" src="/brand/nova-poshta.svg" width={24} height={24} alt="" /> : <TruckIcon />,
      value: deliveryMethodLabel[order.deliveryMethod] ?? order.deliveryMethod,
      sub: (pickup ? pickup.address : where) || undefined,
      extra: pickup && <>
        {pickup.schedule && <span className="order-facts__sub">Графік роботи · {pickup.schedule}</span>}
        {pickup.route && <a className="link order-facts__route" href={pickup.route} target="_blank" rel="noopener noreferrer">Прокласти маршрут <span aria-hidden="true">↗</span></a>}
      </>,
    },
    {
      label: "Оплата",
      icon: <WalletIcon />,
      value: paymentMethodLabel[order.paymentMethod] ?? order.paymentMethod,
      sub: paymentStatusLabel[order.paymentStatus],
    },
    { label: "Покупець", icon: <UserIcon />, value: order.customer.name, sub: [order.customer.phone, order.customer.email].filter(Boolean).join(" · ") },
  ];
  if (order.delivery.recipientName) {
    rows.push({ label: "Отримувач", icon: <UserIcon />, value: order.delivery.recipientName, sub: order.delivery.recipientPhone ?? undefined });
  }
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
              {row.extra}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
