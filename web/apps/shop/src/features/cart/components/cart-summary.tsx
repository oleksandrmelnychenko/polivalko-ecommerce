import Link from "next/link";
import type { Quote } from "@polivalko/shared/api/types";
import { formatMoney } from "@polivalko/shared/lib/format";
import { DeliveryIcon } from "@/shared/ui/delivery-icon";

export function CartSummary({ quote, count, blocking }: { quote: Quote | null; count: number; blocking: boolean }) {
  return (
    <aside className="summary" aria-labelledby="cart-summary-title">
      <h2 id="cart-summary-title">Разом</h2>
      <dl className="totals">
        <dt>Товари, {count} шт.</dt>
        <dd><span className="money">{quote ? formatMoney(quote.subtotal) : "…"}</span></dd>
        <dt className="grand">Сума</dt>
        <dd className="grand"><span className="money">{quote ? formatMoney(quote.total) : "…"}</span></dd>
      </dl>

      {quote && quote.deliveryMethods.length > 0 && (
        <section className="cart-ways" aria-labelledby="cart-ways-title">
          <h3 id="cart-ways-title">Отримання й оплата</h3>
          <ul>
            {quote.deliveryMethods.map((d) => (
              <li key={d.code}>
                <span className="cart-ways__icon" aria-hidden="true"><DeliveryIcon code={d.code} /></span>
                <div className="cart-ways__info">
                  <b>{d.name}</b>
                  {d.description && <span>{d.description}</span>}
                  <span>{d.priceNote || (d.code === "pickup" ? "Безкоштовно" : "За тарифами перевізника")}</span>
                  {d.paymentMethods.length > 0 && <small>Оплата: {d.paymentMethods.map((p) => p.name).join(", ")}</small>}
                </div>
              </li>
            ))}
          </ul>
          <p className="field__help">Спосіб отримання й оплати оберете під час оформлення.</p>
        </section>
      )}

      {blocking && <p className="notice notice--error">Частини товарів не вистачає. Змініть кількість або приберіть позначені позиції.</p>}
      {blocking ? (
        <button type="button" className="btn btn--wide" disabled>
          Оформити замовлення
        </button>
      ) : (
        <Link href="/checkout" className="btn btn--wide">
          Оформити замовлення
        </Link>
      )}
    </aside>
  );
}
