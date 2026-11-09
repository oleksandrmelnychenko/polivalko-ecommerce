import Link from "next/link";
import type { ReactNode } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { countProducts, formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";
import { QuantityStepper } from "@/shared/ui/quantity-stepper";

export function CheckoutSummary({
  quote,
  quoteError,
  delivery,
  priceNote,
  sending,
  setQuantity,
  remove,
  consent,
}: {
  quote: Quote | null;
  quoteError: boolean;
  delivery: string;
  priceNote?: string | null;
  sending: boolean;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  consent: ReactNode;
}) {
  const count = (quote?.items ?? []).reduce((sum, item) => sum + item.quantity, 0);
  return (
    <aside className="summary co-summary" aria-labelledby="summary-title">
      <header className="co-summary__head">
        <h2 id="summary-title">Ваше замовлення</h2>
        {count > 0 && <span>{countProducts(count)}</span>}
      </header>
      {quoteError && <p className="notice notice--error">Не вдалося перевірити ціни. Оновіть сторінку.</p>}
      {quote && !quote.dataFresh && (
        <p className="notice">
          <strong>Ціни й наявність потребують підтвердження</strong>
          Зараз ми не можемо звірити їх зі складом. Менеджер підтвердить замовлення телефоном, після цього стане доступна оплата карткою. До підтвердження
          товар не резервується.
        </p>
      )}
      <ul className="co-summary__lines">
        {(quote?.items ?? []).map((item) => (
          <li key={item.productId} className="line">
            <span className="line__photo">{item.imageUrl && <img src={thumb(item.imageUrl)} alt="" width={56} height={56} loading="lazy" />}</span>
            <div>
              <p className="line__name">
                <Link href={`/product/${item.slug}`}>{item.name}</Link>
              </p>
              <p className="co-summary__unit">{formatMoney(item.unitPrice)} за шт.</p>
              <div className="line__controls">
                <QuantityStepper small value={item.quantity} onChange={(q) => setQuantity(item.productId, q)} label={`Кількість: ${item.name}`} />
                <button type="button" className="remove" onClick={() => remove(item.productId)}>
                  Прибрати
                </button>
              </div>
              {item.issue === "insufficient_stock" && <p className="line__issue">Доступно лише {item.availableQuantity} шт.</p>}
              {item.issue === "unavailable" && <p className="line__issue">Товар зараз недоступний, приберіть його.</p>}
            </div>
            <p className="line__total">{formatMoney(item.lineTotal)}</p>
          </li>
        ))}
        {!quote && !quoteError && <li className="skeleton" style={{ height: "var(--space-4xl)" }} />}
      </ul>
      {quote && (
        <dl className="totals">
          <dt>Товари</dt>
          <dd>{formatMoney(quote.subtotal)}</dd>
          <dt>Доставка</dt>
          <dd>{delivery === "pickup" ? "Безкоштовно" : priceNote || "За тарифами перевізника"}</dd>
          <dt className="grand">До сплати</dt>
          <dd className="grand">{formatMoney(quote.total)}</dd>
        </dl>
      )}
      <div className="co-summary__confirm">
        {consent}
        <button type="submit" className="btn btn--wide" disabled={sending} aria-busy={sending}>
          {sending ? "Оформлюємо…" : "Підтвердити замовлення"}
        </button>
        <p className="field__help">Ціни ще раз звіримо зі складом. Якщо щось зміниться, покажемо нову суму до підтвердження.</p>
      </div>
    </aside>
  );
}
