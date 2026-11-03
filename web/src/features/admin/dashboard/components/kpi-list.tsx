import { formatMoney } from "@/shared/lib/format";
import { BagIcon, TagIcon, UsersIcon, WalletIcon } from "@/shared/ui/icons";
import type { Dashboard } from "../lib/types";
import { Delta } from "./delta";

export function KpiList({ data }: { data: Dashboard }) {
  const { current: c, previous: p } = data;
  const kpis = [
    { label: "Виручка", icon: <WalletIcon />, value: formatMoney(c.revenue), delta: <Delta current={Number(c.revenue.value)} previous={Number(p.revenue.value)} />, foot: `було ${formatMoney(p.revenue)}` },
    { label: "Замовлення", icon: <BagIcon />, value: c.orders.toLocaleString("uk-UA"), delta: <Delta current={c.orders} previous={p.orders} />, foot: c.cancelled ? `скасовано ${c.cancelled}` : `було ${p.orders}` },
    { label: "Середній чек", icon: <TagIcon />, value: formatMoney(c.averageOrder), delta: <Delta current={Number(c.averageOrder.value)} previous={Number(p.averageOrder.value)} />, foot: `було ${formatMoney(p.averageOrder)}` },
    { label: "Покупці", icon: <UsersIcon />, value: c.customers.toLocaleString("uk-UA"), delta: <Delta current={c.customers} previous={p.customers} />, foot: `було ${p.customers}` },
  ];
  return (
    <ul className="dash-kpis">
      {kpis.map((k) => (
        <li key={k.label} className="kpi">
          <span className="kpi__label">
            {k.icon}
            {k.label}
          </span>
          <span className="kpi__value">{k.value}</span>
          <span className="kpi__foot">
            {k.delta}
            <span>{k.foot}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
