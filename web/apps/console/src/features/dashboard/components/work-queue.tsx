import Link from "next/link";
import { ChevronRightIcon } from "@polivalko/shared/ui/icons";
import type { Summary } from "../lib/types";

export function WorkQueue({ summary }: { summary: Summary }) {
  const items = [
    { n: summary.newOrders, label: "нових замовлень", href: "/orders?status=new" },
    { n: summary.awaitingConfirmation, label: "чекають підтвердження", href: "/orders?status=awaitingConfirmation" },
    { n: summary.awaitingPayment, label: "чекають оплати", href: "/orders?status=awaitingPayment" },
    { n: summary.newServiceRequests, label: "нових заявок на послуги", href: "/requests?status=new" },
  ];
  return (
    <ul className="dash-queue" aria-label="Черга на обробку">
      {items.map((i) => (
        <li key={i.label}>
          <Link href={i.href} className={i.n > 0 && i.label !== "чекають оплати" ? "is-hot" : undefined}>
            <b>{i.n}</b>
            <span>{i.label}</span>
            <ChevronRightIcon />
          </Link>
        </li>
      ))}
    </ul>
  );
}
