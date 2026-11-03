import type { Selection } from "@/shared/admin/ui/selection";

export function ProductsBulkBar({ selection, busy, onVisible }: { selection: Selection; busy: boolean; onVisible: (visible: boolean) => void }) {
  return (
    <div className="bulk-bar" role="region" aria-label="Дії з вибраними товарами">
      <span className="bulk-bar__count">
        <b>{selection.selected.size}</b>вибрано
      </span>
      <button type="button" className="btn btn--small btn--accent" disabled={busy} onClick={() => onVisible(true)}>
        Показати на сайті
      </button>
      <button type="button" className="btn btn--small btn--accent" disabled={busy} onClick={() => onVisible(false)}>
        Приховати
      </button>
      <button type="button" className="btn btn--small btn--ghost" onClick={selection.clear}>
        Зняти вибір
      </button>
    </div>
  );
}
