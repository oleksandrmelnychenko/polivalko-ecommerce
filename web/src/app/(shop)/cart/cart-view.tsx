"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { CloseIcon } from "@/components/icons";
import { useCart } from "@/lib/cart";
import { formatMoney, formatPrice } from "@/lib/format";
import { thumb } from "@/lib/images";
import { useCartQuote } from "@/lib/quote";

const noop = () => () => {};

/**
 * Сторінка кошика (розділи 3 і 5 ТЗ): склад із цінами й наявністю, які перерахував сервер, зміна кількості,
 * видалення, підсумок і умови отримання та оплати ще до оформлення. Бічна панель лишається для швидкого перегляду.
 */
export function CartView() {
  const { lines, count, setQuantity, remove, clear } = useCart();
  const { quote, failed } = useCartQuote();
  // Кошик живе в localStorage: до гідратації сервер його не бачить, тож замість «порожньо» — заглушка.
  const hydrated = useSyncExternalStore(noop, () => true, () => false);

  if (!hydrated) return <div className="skeleton" style={{ height: "var(--space-4xl)" }} aria-busy="true" />;

  if (lines.length === 0) {
    return (
      <div className="empty">
        <h2>У кошику поки нічого</h2>
        <p>Додайте товари з каталогу, і вони з&apos;являться тут.</p>
        <Link href="/catalog" className="btn">
          Обрати товари
        </Link>
      </div>
    );
  }

  const blocking = quote?.items.some((i) => i.issue) ?? false;
  // Поки сервер не відповів, показуємо знімок із браузера; щойно відповів — його ціни й наявність.
  const rows = quote
    ? quote.items.map((i) => ({ ...i, unit: formatMoney(i.unitPrice), total: formatMoney(i.lineTotal) }))
    : lines.map((l) => ({
        ...l,
        issue: null,
        availableQuantity: null,
        unit: formatPrice(l.price),
        total: formatPrice(Number(l.price) * l.quantity),
      }));

  return (
    <div className="cart">
      <section className="cart__main" aria-labelledby="cart-lines-title">
        <h2 id="cart-lines-title" className="visually-hidden">
          Товари в кошику
        </h2>
        {failed && <p className="notice notice--error">Не вдалося перевірити ціни й наявність. Оновіть сторінку.</p>}
        {quote && !quote.dataFresh && (
          <p className="notice">
            <strong>Ціни й наявність потребують підтвердження</strong>
            Зараз ми не можемо звірити їх зі складом. Після оформлення менеджер підтвердить замовлення телефоном.
          </p>
        )}
        <div className="cart__head" aria-hidden="true">
          <span>Товар</span>
          <span>Ціна</span>
          <span>Кількість</span>
          <span>Сума</span>
        </div>
        <ul className="cart__lines">
          {rows.map((row) => (
            <li key={row.productId} className="cart-line">
              <Link href={`/product/${row.slug}`} className="cart-line__photo" tabIndex={-1} aria-hidden="true">
                {row.imageUrl && <img src={thumb(row.imageUrl)} alt="" width={96} height={96} loading="lazy" />}
              </Link>
              <div className="cart-line__info">
                <p className="line__name">
                  <Link href={`/product/${row.slug}`}>{row.name}</Link>
                </p>
                <p className="code line__sku" translate="no">
                  {row.sku}
                </p>
                {row.issue === "insufficient_stock" && <p className="line__issue">Доступно лише {row.availableQuantity} шт.</p>}
                {row.issue === "unavailable" && <p className="line__issue">Товар зараз недоступний, приберіть його.</p>}
              </div>
              <p className="cart-line__price">
                <span className="cart-line__label">Ціна: </span>
                {row.unit}
              </p>
              <div className="cart-line__qty">
                <QuantityStepper small value={row.quantity} onChange={(q) => setQuantity(row.productId, q)} label={`Кількість: ${row.name}`} />
              </div>
              <p className="line__total">{row.total}</p>
              <button type="button" className="cart-line__remove" onClick={() => remove(row.productId)} aria-label={`Прибрати: ${row.name}`} title="Прибрати">
                <CloseIcon />
              </button>
            </li>
          ))}
        </ul>
        <div className="cart__after">
          <Link href="/catalog" className="btn btn--quiet">
            Продовжити покупки
          </Link>
          <button type="button" className="remove" onClick={clear}>
            Очистити кошик
          </button>
        </div>
      </section>

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
    </div>
  );
}
