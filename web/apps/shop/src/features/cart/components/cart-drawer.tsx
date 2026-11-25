"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useRef } from "react";
import { formatPrice } from "@polivalko/shared/lib/format";
import { thumb } from "@/shared/lib/images";
import { CloseIcon } from "@polivalko/shared/ui/icons";
import { CartEmpty } from "./cart-empty";
import { QuantityStepper } from "@/shared/ui/quantity-stepper";
import { useCart } from "./cart-provider";

export function CartDrawer() {
  const { ready, saving, error, cart, lines, isOpen, close, setQuantity, remove, count, refresh } = useCart();
  const dialog = useRef<HTMLDialogElement>(null);
  const quoted = new Map(cart?.items.map(item => [item.productId, item]));
  const amount = (line: typeof lines[number]) =>
    quoted.get(line.productId)?.issue === "unavailable" ? 0 : Number(line.price) * line.quantity;
  const subtotal = lines.reduce((sum, line) => sum + amount(line), 0);
  const blocked = cart?.items.some(item => item.issue) ?? false;
  const sync = useEffectEvent(() => {
    if (document.visibilityState === "visible" && ready && !saving && lines.length) void refresh();
  });
  useEffect(() => {
    if (!isOpen) return;
    sync();
    const timer = window.setInterval(sync, 30_000);
    return () => window.clearInterval(timer);
  }, [isOpen]);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (!isOpen) {
      if (el.open) el.close();
      return;
    }
    if (!el.open) el.showModal();
    const anchor = document.getElementById("header-cart-button");
    if (!anchor) return;
    const position = () => {
      const rect = anchor.getBoundingClientRect();
      const top = rect.bottom > 0 && rect.bottom < window.innerHeight / 2 ? rect.bottom + 8 : 8;
      el.style.setProperty("--cart-top", `${top}px`);
      el.style.setProperty("--cart-right", `${Math.max(8, document.documentElement.clientWidth - rect.right)}px`);
    };
    position();
    window.addEventListener("resize", position);
    return () => window.removeEventListener("resize", position);
  }, [isOpen]);

  return (
    <dialog
      ref={dialog}
      id="mini-cart"
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

        {(error || !ready) && <p role="status">{error ?? "Завантажуємо кошик…"}{" "}
          {error && <button type="button" className="link" onClick={() => void refresh()}>Спробувати ще раз</button>}
        </p>}
        <p role="status" className={saving && lines.length === 0 ? undefined : "visually-hidden"}>{ready && !error && saving ? "Зберігаємо кошик…" : ""}</p>
        {ready && !saving && !error && lines.length === 0 ? (
          <div className="drawer__lines drawer__lines--empty">
            <CartEmpty drawer onNavigate={close} />
          </div>
        ) : (
          <ul className="drawer__lines">
            {lines.map((line) => (
              <li key={line.productId} className="line">
                <span className="line__photo">{line.imageUrl && <img src={thumb(line.imageUrl)} alt="" width={72} height={72} loading="lazy" />}</span>
                <div>
                  <p className="line__name">
                    {line.slug ? <Link href={`/product/${line.slug}`} onClick={close}>
                      {line.name}
                    </Link> : line.name}
                  </p>
                  <p className="code line__sku" translate="no">
                    {line.sku}
                  </p>
                  {quoted.get(line.productId)?.issue && (
                    <p role="status">{quoted.get(line.productId)?.issue === "unavailable" ? "Немає в наявності" :
                      `Доступно лише ${quoted.get(line.productId)?.availableQuantity} шт.`}</p>
                  )}
                  <div className="line__controls">
                    <QuantityStepper small value={line.quantity} onChange={(q) => setQuantity(line.productId, q)} label={`Кількість: ${line.name}`} />
                    <button type="button" className="remove" onClick={() => remove(line.productId)}>
                      Прибрати
                    </button>
                  </div>
                </div>
                <p className="line__total"><span className="money">{formatPrice(amount(line))}</span></p>
              </li>
            ))}
          </ul>
        )}

        {lines.length > 0 && (
          <div className="drawer__foot">
            <dl className="totals">
              <dt>Разом, {count} шт.</dt>
              <dd className="num"><span className="money">{formatPrice(subtotal)}</span></dd>
            </dl>
            <p className="muted">
              Ціни й наявність ще раз перевіримо під час оформлення. Доставка за тарифами перевізника.
            </p>
            <div className="drawer__actions">
              <Link href="/cart" className="btn btn--quiet" onClick={close}>Перейти в кошик</Link>
              {!blocked && <Link href="/checkout" className="btn drawer__checkout" onClick={close}>
                Оформити замовлення
              </Link>}
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
