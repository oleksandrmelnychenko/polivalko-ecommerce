import Link from "next/link";
import { CheckAll, type Selection } from "@/shared/admin/ui/selection";
import { formatDateTime, formatMoney } from "@/shared/lib/format";
import { thumb } from "@/shared/lib/images";
import { EyeIcon } from "@/shared/ui/icons";
import type { ProductRow } from "../lib/types";
import { StockText } from "./stock-text";

export function ProductsTable({ items, selection }: { items: ProductRow[]; selection: Selection }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th scope="col" className="col-check">
              <CheckAll keys={items.map((p) => p.id)} selection={selection} label="Вибрати всі товари на сторінці" />
            </th>
            <th scope="col">Товар</th>
            <th scope="col">Розділ</th>
            <th scope="col" className="num">
              Ціна
            </th>
            <th scope="col" className="num">
              Залишок
            </th>
            <th scope="col">На сайті</th>
            <th scope="col">Змінено</th>
            <th scope="col" className="col-actions">
              <span className="visually-hidden">Дії</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((p) => (
            <tr key={p.id} data-selected={selection.has(p.id) || undefined}>
              <td className="col-check">
                <input type="checkbox" aria-label={`Вибрати «${p.displayName ?? p.name}»`} checked={selection.has(p.id)} onChange={() => selection.toggle(p.id)} />
              </td>
              <td>
                <span className="cell-main">
                  {p.imageUrl ? <img className="admin-thumb" src={thumb(p.imageUrl, 120)} alt="" loading="lazy" /> : <span className="admin-thumb" />}
                  <span>
                    <Link href={`/admin/catalog/products/${p.id}`} className="cell-strong" style={{ textDecoration: "none" }}>
                      {p.displayName ?? p.name}
                    </Link>
                    <span className="cell-sub">
                      <span className="code">{p.sku}</span>
                      {!p.hasDescription && " · без опису"}
                    </span>
                  </span>
                </span>
              </td>
              <td>{p.categoryName}</td>
              <td className="num cell-strong">{formatMoney(p.price)}</td>
              <td className="num">
                <StockText stock={p.stock} />
              </td>
              <td>{p.isVisible ? <span className="chip chip--green">Показується</span> : <span className="chip chip--grey">Прихований</span>}</td>
              <td className="admin-nowrap">
                <span className="admin-small muted">{formatDateTime(p.updatedAt)}</span>
              </td>
              <td className="col-actions">
                <a className="btn btn--small btn--ghost btn--icon" href={`/product/${p.slug}`} target="_blank" rel="noopener" aria-label={`Відкрити «${p.displayName ?? p.name}» на сайті`} title="На сайті">
                  <EyeIcon />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
