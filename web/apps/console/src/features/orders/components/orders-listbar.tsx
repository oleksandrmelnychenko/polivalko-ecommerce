import { sortLabel } from "../lib/order-filters";

export function OrdersListbar({ totalItems, sort, onSort }: { totalItems: number; sort: string; onSort: (sort: string) => void }) {
  return (
    <div className="console-listbar">
      <p className="console-count">
        Знайдено: {totalItems}
      </p>
      <div className="console-listbar__sort">
        <label className="console-count" htmlFor="sort">
          Порядок
        </label>
        <select id="sort" className="select" value={sort || "newest"} onChange={(e) => onSort(e.target.value === "newest" ? "" : e.target.value)}>
          {Object.entries(sortLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
