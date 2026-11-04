import Link from "next/link";
import { formatMoney } from "@polivalko/shared/lib/format";
import type { Dashboard } from "../lib/types";

export function TopProducts({ data }: { data: Dashboard }) {
  return (
    <section className="console-card" aria-labelledby="top-title">
      <div className="console-card__head">
        <h2 id="top-title">Топ товарів</h2>
        <span className="muted">за виручкою</span>
      </div>
      {data.topProducts.length === 0 ? (
        <p className="rank__empty">Продажів за період немає.</p>
      ) : (
        <ol className="rank">
          {data.topProducts.map((t, i) => (
            <li key={t.productId}>
              <span className="rank__n">{i + 1}</span>
              {t.imageUrl ? <img className="console-thumb" src={t.imageUrl} alt="" loading="lazy" /> : <span className="console-thumb" />}
              <span className="rank__main">
                <Link href={`/catalog/products/${t.productId}`}>{t.name}</Link>
                <span className="cell-sub">{t.sku}</span>
              </span>
              <span className="rank__side">
                {formatMoney(t.revenue)}
                <span className="cell-sub">{t.quantity} шт.</span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
