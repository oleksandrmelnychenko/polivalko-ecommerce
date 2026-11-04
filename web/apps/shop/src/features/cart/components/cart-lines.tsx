import Link from "next/link";
import type { Quote } from "@polivalko/shared/api/types";
import { thumb } from "@polivalko/shared/lib/images";
import { CloseIcon } from "@polivalko/shared/ui/icons";
import { QuantityStepper } from "@/shared/ui/quantity-stepper";
import type { CartRow } from "../lib/cart-rows";

export function CartLines({
  rows,
  quote,
  failed,
  setQuantity,
  remove,
  clear,
}: {
  rows: CartRow[];
  quote: Quote | null;
  failed: boolean;
  setQuantity: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}) {
  return (
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
  );
}
