import type { Selection } from "@/shared/admin/ui/selection";
import type { OrderStatus } from "@/shared/api/types";
import { orderStatusLabel } from "@/shared/lib/labels";

export function OrdersBulkBar({
  selection,
  status,
  busy,
  onStatus,
  onApply,
}: {
  selection: Selection;
  status: OrderStatus | "";
  busy: boolean;
  onStatus: (status: OrderStatus) => void;
  onApply: () => void;
}) {
  return (
    <div className="bulk-bar" role="region" aria-label="Дії з вибраними замовленнями">
      <span className="bulk-bar__count">
        <b>{selection.selected.size}</b>вибрано
      </span>
      <label className="visually-hidden" htmlFor="bulk-status">
        Новий статус
      </label>
      <select id="bulk-status" className="select" value={status} onChange={(e) => onStatus(e.target.value as OrderStatus)}>
        <option value="">Змінити статус на…</option>
        {(Object.keys(orderStatusLabel) as OrderStatus[])
          .filter((s) => s !== "new")
          .map((s) => (
            <option key={s} value={s}>
              {orderStatusLabel[s]}
            </option>
          ))}
      </select>
      <button type="button" className="btn btn--small btn--accent" disabled={!status || busy} aria-busy={busy} onClick={onApply}>
        {busy ? "Змінюємо…" : "Застосувати"}
      </button>
      <button type="button" className="btn btn--small btn--ghost" onClick={selection.clear}>
        Зняти вибір
      </button>
    </div>
  );
}
