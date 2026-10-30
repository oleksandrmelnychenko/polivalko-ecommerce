"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { thumb } from "@/lib/images";
import { CloseIcon } from "./icons";
import { QuantityStepper } from "./quantity-stepper";

/** Шухляда кошика на нативному <dialog>: фокус, Esc і фон браузер дає сам. */
export function CartDrawer() {
  const { lines, isOpen, close, setQuantity, remove, subtotal, count } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (isOpen && !el.open) el.showModal();
    if (!isOpen && el.open) el.close();
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      className="drawer"
      aria-labelledby="cart-title"
      onClose={close}
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div className="drawer__inner">
        <div className="drawer__head">
          <h2 id="cart-title">Кошик</h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Закрити кошик">
            <CloseIcon />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="drawer__lines">
            <div className="empty" style={{ marginTop: "var(--space-lg)" }}>
              <h2>Кошик порожній</h2>
              <p>Додайте товари з каталогу, і вони з&apos;являться тут.</p>
              <Link href="/catalog" className="btn btn--quiet" onClick={close}>
                Перейти до каталогу
              </Link>
            </div>
          </div>
        ) : (
          <ul className="drawer__lines">
            {lines.map((line) => (
              <li key={line.productId} className="line">
                <span className="line__photo">{line.imageUrl && <img src={thumb(line.imageUrl)} alt="" width={72} height={72} loading="lazy" />}</span>
                <div>
                  <p className="line__name">
                    <Link href={`/product/${line.slug}`} onClick={close}>
                      {line.name}
                    </Link>
                  </p>
                  <p className="code line__sku" translate="no">
                    {line.sku}
                  </p>
                  <div className="line__controls">
                    <QuantityStepper small value={line.quantity} onChange={(q) => setQuantity(line.productId, q)} label={`Кількість: ${line.name}`} />
                    <button type="button" className="remove" onClick={() => remove(line.productId)}>
                      Прибрати
                    </button>
                  </div>
                </div>
                <p className="line__total">{formatPrice(Number(line.price) * line.quantity)}</p>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="drawer__foot">
            <dl className="totals">
              <dt>Разом, {count} шт.</dt>
              <dd className="num">{formatPrice(subtotal)}</dd>
            </dl>
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              Ціни й наявність ще раз перевіримо під час оформлення. Доставка за тарифами перевізника.
            </p>
            <Link href="/checkout" className="btn btn--wide" onClick={close}>
              Оформити замовлення
            </Link>
            <Link href="/cart" className="btn btn--quiet btn--wide" onClick={close}>
              Перейти в кошик
            </Link>
          </div>
        )}
      </div>
    </dialog>
  );
}
