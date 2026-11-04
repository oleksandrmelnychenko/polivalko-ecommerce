import { orderStatusLabel } from "@polivalko/shared/lib/labels";
import { ChevronRightIcon } from "@polivalko/shared/ui/icons";
import type { useOrderStatusChange } from "../hooks/use-order-status-change";
import type { ConsoleOrder } from "../lib/types";

export function OrderDetailStatusPanel({ order: o, status }: { order: ConsoleOrder; status: ReturnType<typeof useOrderStatusChange> }) {
  const { reason, setReason, busy, error, change } = status;
  return (
    <aside className="console-panel console-panel--status" aria-labelledby="status-title">
      <h2 id="status-title">Змінити статус</h2>
      {o.allowedTransitions.length === 0 ? (
        <p className="muted">Зі статусу «{orderStatusLabel[o.status]}» переходів немає.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="reason">Причина або коментар</label>
            <input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="Необов'язково…" autoComplete="off" />
          </div>
          <div className="status-actions">
            {o.allowedTransitions.map((s) => (
              <button
                key={s}
                type="button"
                className={s === "cancelled" ? "btn btn--danger" : "btn"}
                disabled={busy !== null}
                aria-busy={busy === s}
                onClick={() => change(s)}
              >
                {busy === s ? "Змінюємо…" : orderStatusLabel[s]}
                <ChevronRightIcon />
              </button>
            ))}
          </div>
        </>
      )}
      <p className="field__help" style={{ marginTop: "var(--space-sm)" }}>
        Статус оплати змінює лише підтвердження платіжного провайдера.
      </p>
      {error && (
        <p className="notice notice--error" role="alert" style={{ marginTop: "var(--space-sm)" }}>
          {error}
        </p>
      )}
    </aside>
  );
}
