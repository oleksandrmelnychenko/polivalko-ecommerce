import type { Dispatch, SetStateAction } from "react";
import { formatMoney } from "@polivalko/shared/lib/format";
import type { ProductRow } from "../lib/types";

export function CollectionsItems({ items, setItems }: { items: ProductRow[]; setItems: Dispatch<SetStateAction<ProductRow[]>> }) {
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });

  return (
    <>
      <h3>Товари ({items.length} з 24)</h3>
      {items.length > 0 ? (
        <ol className="pick-list">
          {items.map((item, i) => (
            <li key={item.id}>
              <span>
                {item.displayName ?? item.name} <span className="muted">{formatMoney(item.price)}</span>
                {!item.isVisible && <span className="muted"> (прихований, на головній не з&apos;явиться)</span>}
              </span>
              <span className="row" style={{ display: "flex", gap: "var(--space-3xs)" }}>
                <button type="button" className="btn btn--small btn--quiet" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Вище: ${item.name}`}>
                  ↑
                </button>
                <button type="button" className="btn btn--small btn--quiet" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label={`Нижче: ${item.name}`}>
                  ↓
                </button>
                <button type="button" className="btn btn--small btn--quiet" onClick={() => setItems((list) => list.filter((x) => x.id !== item.id))} aria-label={`Прибрати: ${item.name}`}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted">Додайте товари пошуком нижче.</p>
      )}
    </>
  );
}
