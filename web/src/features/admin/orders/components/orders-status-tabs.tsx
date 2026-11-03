import type { components } from "@/shared/api/schema";
import type { OrderStatus } from "@/shared/api/types";
import { orderStatusLabel } from "@/shared/lib/labels";

type Counts = components["schemas"]["AdminOrderCountsDto"];

export function OrdersStatusTabs({ status, counts, onStatus }: { status: string; counts?: Counts; onStatus: (status: string) => void }) {
  const countOf = (s: OrderStatus) => counts?.byStatus.find((x) => x.status === s)?.count ?? 0;
  return (
    <nav className="admin-tabs" aria-label="Статус замовлення">
      <button type="button" aria-pressed={!status} onClick={() => onStatus("")}>
        Усі <span className="tab-count">{counts?.all ?? "·"}</span>
      </button>
      {(Object.keys(orderStatusLabel) as OrderStatus[]).map((s) => {
        const n = countOf(s);
        return (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => onStatus(s)}>
            {orderStatusLabel[s]}
            <span className={`tab-count${n > 0 && (s === "new" || s === "awaitingConfirmation") ? " tab-count--hot" : ""}`}>{counts ? n : "·"}</span>
          </button>
        );
      })}
    </nav>
  );
}
