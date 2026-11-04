import Link from "next/link";
import type { Quote } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@polivalko/shared/lib/images";
import { QuantityStepper } from "@/shared/ui/quantity-stepper";

export function CheckoutSummary({
  quote,
  quoteError,
  delivery,
  sending,
  setQuantity,
  remove,
}: {
  quote: Quote | null;
  quoteError: boolean;
  delivery: string;
  sending: boolean;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
}) {
  return (
    <aside className="summary" aria-labelledby="summary-title">
      <h2 id="summary-title">Ваше замовлення</h2>
      {quoteError && <p className="notice notice--error">Не вдалося перевірити ціни. Оновіть сторінку.</p>}
      {quote && !quote.dataFresh && (
        <p className="notice">
          <strong>Ціни й наявність потребують підтвердження</strong>
          Зараз ми не можемо звірити їх зі складом. Замовлення прийме менеджер і підтвердить телефоном; онлайн-оплата
          стане доступною після підтвердження, резерв до того не діє.
        </p>
      )}
      <ul>
        {(quote?.items ?? []).map((item) => (
          <li key={item.productId} className="line">
            <span className="line__photo">{item.imageUrl && <img src={thumb(item.imageUrl)} alt="" width={56} height={56} loading="lazy" />}</span>
            <div>
              <p className="line__name">
                <Link href={`/product/${item.slug}`}>{item.name}</Link>
              </p>
              <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
                {formatMoney(item.unitPrice)} за шт.
              </p>
              <div className="line__controls">
                <QuantityStepper small value={item.quantity} onChange={(q) => setQuantity(item.productId, q)} label={`Кількість: ${item.name}`} />
                <button type="button" className="remove" onClick={() => remove(item.productId)}>
                  Прибрати
                </button>
              </div>
              {item.issue === "insufficient_stock" && (
                <p className="line__issue">Доступно лише {item.availableQuantity} шт.</p>
              )}
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
          <dd>{delivery === "pickup" ? "Безкоштовно" : "За тарифами перевізника"}</dd>
          <dt className="grand">До сплати</dt>
          <dd className="grand">{formatMoney(quote.total)}</dd>
        </dl>
      )}
      <button type="submit" className="btn btn--wide" disabled={sending} aria-busy={sending}>
        {sending ? "Оформлюємо…" : "Підтвердити замовлення"}
      </button>
      <p className="field__help">Ціни ще раз звіримо зі складом. Якщо щось зміниться, покажемо нову суму до підтвердження.</p>
    </aside>
  );
}
