import Link from "next/link";
import type { ReactNode } from "react";
import type { Quote } from "@polivalko/shared/api/types";
import { countProducts, formatMoney } from "@polivalko/shared/lib/format";
import { thumb } from "@/shared/lib/images";
import { QuantityStepper } from "@/shared/ui/quantity-stepper";
import { RemoveCartItem, type CartRow } from "@/features/cart";

export function CheckoutSummary({
  quote,
  quoteError,
  retryQuote,
  delivery,
  priceNote,
  sending,
  canConfirm,
  rows,
  setQuantity,
  remove,
  consent,
}: {
  quote: Quote | null;
  quoteError: boolean;
  retryQuote: () => void;
  delivery: string;
  priceNote?: string | null;
  sending: boolean;
  canConfirm: boolean;
  rows: CartRow[];
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  consent: ReactNode;
}) {
  const count = rows.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <aside className="summary co-summary" aria-labelledby="summary-title">
      <header className="co-summary__head">
        <h2 id="summary-title">Ваше замовлення</h2>
        {count > 0 && <span>{countProducts(count)}</span>}
      </header>
      {quoteError && (
        <p className="notice notice--error" role="alert">
          <strong>Не вдалося перевірити ціни</strong>
          Перевірте зв&apos;язок і спробуйте ще раз.{" "}
          <button type="button" className="btn btn--quiet btn--small" onClick={retryQuote}>
            Спробувати ще раз
          </button>
        </p>
      )}
      {quote && !quote.dataFresh && (
        <p className="notice">
          <strong>Ціни й наявність потребують підтвердження</strong>
          Зараз ми не можемо звірити їх зі складом. Менеджер підтвердить замовлення телефоном, після цього стане доступна оплата карткою. Товар
          резервується одразу після оформлення.
        </p>
      )}
      <ul className="co-summary__lines">
        {rows.map((item) => (
          <li key={item.productId} className="line">
            <span className="line__photo">{item.imageUrl && <img src={thumb(item.imageUrl)} alt="" width={56} height={56} loading="lazy" />}</span>
            <div>
              <p className="line__name">
                {item.slug ? <Link href={`/product/${item.slug}`}>{item.name}</Link> : item.name}
              </p>
              <p className="co-summary__unit">
                <span className="money">{item.unit}</span> за шт.
              </p>
              <div className="line__controls">
                <QuantityStepper small max={item.availableQuantity ?? undefined} value={item.quantity} onChange={(q) => setQuantity(item.productId, q)} label={`Кількість: ${item.name}`} />
                <RemoveCartItem name={item.name} onRemove={() => remove(item.productId)} />
              </div>
              {item.issue === "insufficient_stock" && <p className="line__issue">Доступно лише {item.availableQuantity} шт.</p>}
              {item.issue === "unavailable" && <p className="line__issue">Товар зараз недоступний, приберіть його.</p>}
            </div>
            <p className="line__total"><span className="money">{item.total}</span></p>
          </li>
        ))}
      </ul>
      {!quote && !quoteError && <p role="status" className="field__help">Уточнюємо суму замовлення…</p>}
      {quote && (
        <dl className="totals">
          <dt>Товари</dt>
          <dd><span className="money">{formatMoney(quote.subtotal)}</span></dd>
          <dt>Доставка</dt>
          <dd>{delivery === "pickup" ? "Безкоштовно" : priceNote || "За тарифами перевізника"}</dd>
          <dt className="grand">{delivery === "pickup" ? "До сплати" : "Разом за товари"}</dt>
          <dd className="grand"><span className="money">{formatMoney(quote.total)}</span></dd>
        </dl>
      )}
      <div className="co-summary__confirm">
        {consent}
        <button type="submit" className="btn btn--wide" disabled={sending || !canConfirm} aria-busy={sending}>
          {sending ? "Оформлюємо…" : "Підтвердити замовлення"}
        </button>
      </div>
    </aside>
  );
}
