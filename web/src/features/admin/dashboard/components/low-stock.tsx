import Link from "next/link";
import { StockText } from "@/features/admin/catalog";
import type { Dashboard } from "../lib/types";

export function LowStock({ data }: { data: Dashboard }) {
  return (
    <section className="admin-card" aria-labelledby="stock-title">
      <div className="admin-card__head">
        <h2 id="stock-title">Закінчуються</h2>
        <Link href="/admin/catalog?stock=low" className="link">
          Усі
        </Link>
      </div>
      {data.lowStock.length === 0 ? (
        <p className="rank__empty">Усі товари в достатній кількості.</p>
      ) : (
        <ul className="rank">
          {data.lowStock.map((s) => (
            <li key={s.id}>
              <span className="rank__main">
                <Link href={`/admin/catalog/products/${s.id}`}>{s.name}</Link>
                <span className="cell-sub">{s.sku}</span>
              </span>
              <span className="rank__side">
                <StockText stock={s.stock} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
