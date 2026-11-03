import Link from "next/link";
import type { Quote } from "@/shared/api/types";
import { formatMoney } from "@/shared/lib/format";

export function CartSummary({ quote, count, blocking }: { quote: Quote | null; count: number; blocking: boolean }) {
  return (
    <aside className="summary" aria-labelledby="cart-summary-title">
      <h2 id="cart-summary-title">Разом</h2>
      <dl className="totals">
        <dt>Товари, {count} шт.</dt>
        <dd>{quote ? formatMoney(quote.subtotal) : "…"}</dd>
        <dt className="grand">Сума</dt>
        <dd className="grand">{quote ? formatMoney(quote.total) : "…"}</dd>
      </dl>

      {quote && (
        <div className="cart-ways">
          <h3>Отримання й оплата</h3>
          <ul>
            {quote.deliveryMethods.map((d) => (
              <li key={d.code}>
                <b>{d.name}</b>
                <span>Доставка {d.code === "pickup" ? "безкоштовна" : "за тарифами перевізника"}</span>
                <small>Оплата: {d.paymentMethods.map((p) => p.name.toLowerCase()).join(", ")}</small>
              </li>
            ))}
          </ul>
          <p className="field__help">Спосіб отримання й оплати оберете під час оформлення.</p>
        </div>
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
      <p className="field__help">Ціни ще раз звіримо зі складом під час оформлення.</p>
    </aside>
  );
}
