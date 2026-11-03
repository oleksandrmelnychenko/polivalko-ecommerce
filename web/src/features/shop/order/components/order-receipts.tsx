import type { Receipt } from "@/shared/api/types";
import { formatMoney } from "@/shared/lib/format";
import { receiptKindLabel } from "@/shared/lib/labels";

export function OrderReceipts({ receipts }: { receipts: Receipt[] }) {
  return (
    <section aria-labelledby="receipts-title">
      <h2 id="receipts-title">Чеки</h2>
      <ul className="receipts">
        {receipts.map((r) => (
          <li key={r.id}>
            <span>
              {receiptKindLabel[r.kind] ?? r.kind}, {formatMoney(r.amount)}
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
