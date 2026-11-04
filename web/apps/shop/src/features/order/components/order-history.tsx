import Link from "next/link";
import type { Order } from "@polivalko/shared/api/types";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { orderStatusLabel } from "@polivalko/shared/lib/labels";

export function OrderHistory({ order, back = { href: "/catalog", label: "Повернутися до каталогу" } }: { order: Order; back?: { href: string; label: string } }) {
  return (
    <aside className="summary" aria-labelledby="history-title">
      <h2 id="history-title">Історія</h2>
      <ol className="timeline">
        {[...order.history].reverse().map((h, i) => (
          <li key={`${h.status}-${i}`}>
            <span>{orderStatusLabel[h.status]}</span>
            <time dateTime={h.at}>{formatDateTime(h.at)}</time>
          </li>
        ))}
      </ol>
      <p className="field__help">
        Створено {formatDateTime(order.createdAt)}. Продавець: {order.sellerName}.
      </p>
      <Link href={back.href} className="btn btn--quiet">
        {back.label}
      </Link>
    </aside>
  );
}
