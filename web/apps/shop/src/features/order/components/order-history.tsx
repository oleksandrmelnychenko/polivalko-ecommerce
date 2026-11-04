import Link from "next/link";
import type { Order } from "@polivalko/shared/api/types";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { orderStatusLabel } from "@polivalko/shared/lib/labels";

export function OrderHistory({ order }: { order: Order }) {
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
      <Link href="/catalog" className="btn btn--quiet">
        Повернутися до каталогу
      </Link>
    </aside>
  );
}
