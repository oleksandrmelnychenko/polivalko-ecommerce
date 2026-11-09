import type { Receipt } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { receiptKindLabel } from "@polivalko/shared/lib/labels";

export function OrderReceipts({ receipts }: { receipts: Receipt[] }) {
  return (
    <section aria-labelledby="receipts-title">
      <h2 id="receipts-title">Чеки</h2>
      <ul className="receipts">
        {receipts.map((r) => (
          <li key={r.id}>
            <span>
              {receiptKindLabel[r.kind] ?? r.kind}, <span className="money">{formatMoney(r.amount)}</span>
              <br />
              <span className="muted">
                Фіскальний номер <span className="code">{r.fiscalCode}</span>
              </span>
            </span>
            {r.url && (
              <a className="link" href={r.url} target="_blank" rel="noopener">
                Відкрити чек
              </a>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
