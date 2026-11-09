import Link from "next/link";
import type { Quote } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
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
}: {
  quote: Quote | null;
  quoteError: boolean;
  delivery: string;
  priceNote?: string | null;
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
          стане доступною після підтвердження. Товар резервується на сайті після оформлення.
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
                <span className="money">{formatMoney(item.unitPrice)}</span> за шт.
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
            <p className="line__total"><span className="money">{formatMoney(item.lineTotal)}</span></p>
          </li>
        ))}
        {!quote && !quoteError && <li className="skeleton" style={{ height: "var(--space-4xl)" }} />}
      </ul>
      {quote && (
        <dl className="totals">
          <dt>Товари</dt>
          <dd><span className="money">{formatMoney(quote.subtotal)}</span></dd>
          <dt>Доставка</dt>
          <dd>{delivery === "pickup" ? "Безкоштовно" : priceNote || "За тарифами перевізника"}</dd>
          <dt className="grand">До сплати</dt>
          <dd className="grand"><span className="money">{formatMoney(quote.total)}</span></dd>
        </dl>
      )}
      <button type="submit" className="btn btn--wide" disabled={sending} aria-busy={sending}>
        {sending ? "Оформлюємо…" : "Підтвердити замовлення"}
      </button>
      <p className="field__help">Ціни ще раз звіримо зі складом. Якщо щось зміниться, покажемо нову суму до підтвердження.</p>
    </aside>
  );
}
