"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { QuantityStepper } from "@/components/quantity-stepper";
import { browserApi, newIdempotencyKey, type Problem, type Settlement, type Warehouse } from "@/lib/api/browser";
import { track } from "@/lib/analytics";
import { useCart } from "@/lib/cart";
import { formatMoney } from "@/lib/format";
import { thumb } from "@/lib/images";
import { useCartQuote } from "@/lib/quote";
import { SettlementPicker } from "./settlement-picker";

type Errors = Record<string, string | undefined>;

const deliveryHint: Record<string, string> = {
  nova_poshta: "Відділення або поштомат",
  nova_poshta_courier: "Доставка на адресу",
  pickup: "Магазин у Бучі",
};

/**
 * Оформлення гостя. Сума й наявність завжди з сервера (POST /checkout/quote); замовлення
 * створюється з Idempotency-Key та очікуваною сумою, тож повторне натискання не створить дубль,
 * а зміна ціни між показом і підтвердженням повертається покупцю (розділ 5 ТЗ).
 */
export function CheckoutForm() {
  const router = useRouter();
  const { lines, setQuantity, remove, clear } = useCart();
  const { items, quote, failed: quoteError, refresh: refreshQuote } = useCartQuote();
  const [delivery, setDelivery] = useState("nova_poshta");
  const [payment, setPayment] = useState("");
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseRef, setWarehouseRef] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [notice, setNotice] = useState<{ kind: "error" | "info"; title: string; text?: string; items?: string[] } | null>(null);
  const [sending, setSending] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const focusInvalid = useRef(false);

  // Після відповіді сервера з помилками полів курсор переходить на перше таке поле: згода з офертою
  // внизу форми інакше лишається поза екраном, і незрозуміло, чому замовлення не оформилося.
  useEffect(() => {
    if (!focusInvalid.current) return;
    focusInvalid.current = false;
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [errors]);

  // Подія «початок оформлення» один раз за відкриття сторінки, без персональних даних.
  const checkoutTracked = useRef(false);
  useEffect(() => {
    if (!quote || checkoutTracked.current) return;
    checkoutTracked.current = true;
    track("begin_checkout", {
      currency: "UAH",
      value: Number(quote.total.value),
      items: quote.items.map((i) => ({ item_id: i.sku, item_name: i.name, price: Number(i.unitPrice.value), quantity: i.quantity })),
    });
  }, [quote]);

  const deliveryOption = quote?.deliveryMethods.find((d) => d.code === delivery);
  const paymentOptions = deliveryOption?.paymentMethods ?? [];
  // Спосіб оплати залежить від способу отримання: якщо вибраний став недоступним, беремо перший дозволений.
  const effectivePayment = paymentOptions.some((p) => p.code === payment) ? payment : (paymentOptions[0]?.code ?? "");

  async function chooseSettlement(next: Settlement | null) {
    setSettlement(next);
    setWarehouseRef("");
    setWarehouses([]);
    if (!next) return;
    const { data } = await browserApi.GET("/api/v1/delivery/np/warehouses", { params: { query: { settlementRef: next.ref } } });
    setWarehouses(data ?? []);
  }

  const blocking = quote?.items.some((i) => i.issue) ?? false;
  const novaPoshta = delivery === "nova_poshta" || delivery === "nova_poshta_courier";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!quote) return;
    if (blocking) {
      setNotice({ kind: "error", title: "Частини товарів не вистачає", text: "Змініть кількість або приберіть позиції, позначені в замовленні." });
      return;
    }
    const form = new FormData(event.currentTarget);
    setSending(true);
    setNotice(null);
    idempotencyKey.current ??= newIdempotencyKey();

    try {
      const { data, error, response } = await browserApi.POST("/api/v1/orders", {
        params: { header: { "Idempotency-Key": idempotencyKey.current } },
        body: {
          items,
          expectedTotal: quote.total.value,
          customer: {
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            email: String(form.get("email") ?? "") || null,
          },
          delivery: {
            method: delivery,
            settlementRef: novaPoshta ? (settlement?.ref ?? null) : null,
            warehouseRef: delivery === "nova_poshta" ? warehouseRef || null : null,
            address:
              delivery === "nova_poshta_courier"
                ? {
                    street: String(form.get("street") ?? ""),
                    house: String(form.get("house") ?? ""),
                    apartment: String(form.get("apartment") ?? "") || null,
                  }
                : null,
          },
          payment: { method: effectivePayment },
          comment: String(form.get("comment") ?? "") || null,
          acceptOffer: form.get("acceptOffer") === "on",
        },
      });

      if (data) {
        clear();
        router.push(`/order/${data.number}?token=${encodeURIComponent(data.accessToken)}`);
        return;
      }

      const problem = (error ?? {}) as Problem;
      if (response.status === 400 && problem.errors) {
        const fieldErrors = Object.fromEntries(Object.entries(problem.errors).map(([k, v]) => [k, v[0]]));
        focusInvalid.current = true;
        setErrors(fieldErrors);
        setNotice({ kind: "error", title: "Замовлення не оформлено. Виправте поля:", items: [...new Set(Object.values(fieldErrors))] });
      } else if (problem.code === "checkout.price_changed") {
        await refreshQuote();
        setNotice({ kind: "info", title: "Ціни змінилися", text: "Ми оновили суму. Перевірте її й підтвердіть замовлення ще раз." });
      } else if (problem.code === "checkout.insufficient_stock") {
        await refreshQuote();
        setNotice({ kind: "error", title: "Частини товарів не вистачає", text: "Змініть кількість або приберіть позиції, позначені нижче." });
      } else if (response.status === 429) {
        setNotice({ kind: "error", title: "Забагато замовлень за короткий час", text: "Спробуйте за кілька хвилин або зателефонуйте нам." });
      } else if (problem.code === "idempotency.key_mismatch") {
        idempotencyKey.current = null;
        setNotice({ kind: "error", title: "Спробуйте ще раз", text: "Дані змінилися з моменту попередньої спроби." });
      } else {
        setNotice({ kind: "error", title: problem.title ?? "Не вдалося оформити замовлення", text: problem.detail });
      }
    } catch {
      setNotice({ kind: "error", title: "Немає зв'язку з сервером", text: "Повторне натискання безпечне: дубль замовлення не створиться." });
    } finally {
      setSending(false);
    }
  }

  if (lines.length === 0) {
    return (
      <div className="empty">
        <h2>У кошику поки нічого</h2>
        <p>Оберіть товари в каталозі, а потім поверніться сюди.</p>
        <Link href="/catalog" className="btn">
          Обрати товари
        </Link>
      </div>
    );
  }

  const field = (name: string) => ({
    "aria-invalid": Boolean(errors[name]) || undefined,
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });
  const fieldError = (name: string) =>
    errors[name] && (
      <p id={`${name}-error`} className="field__error">
        {errors[name]}
      </p>
    );

  return (
    <form ref={formRef} className="checkout" onSubmit={onSubmit} noValidate>
      <div className="checkout__form">
        {notice && (
          <div className={notice.kind === "error" ? "notice notice--error" : "notice"} role="alert">
            <strong>{notice.title}</strong>
            {notice.text}
            {notice.items && (
              <ul>
                {notice.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}

        <section aria-labelledby="contacts-title">
          <h2 id="contacts-title">
            <span>1</span> Контакти
          </h2>
          <div className="fields-2">
            <div className="field">
              <label htmlFor="name">Ім&apos;я та прізвище</label>
              <input id="name" name="name" autoComplete="name" required maxLength={100} {...field("customer.name")} />
              {fieldError("customer.name")}
            </div>
            <div className="field">
              <label htmlFor="phone">Телефон</label>
              <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" spellCheck={false} placeholder="+380 67 123 45 67" required {...field("customer.phone")} />
              {fieldError("customer.phone")}
            </div>
          </div>
          <div className="field">
            <label htmlFor="email">Email, якщо хочете лист про замовлення</label>
            <input id="email" name="email" type="email" autoComplete="email" spellCheck={false} {...field("customer.email")} />
            {fieldError("customer.email")}
          </div>
        </section>

        <section aria-labelledby="delivery-title">
          <h2 id="delivery-title">
            <span>2</span> Отримання
          </h2>
          <fieldset className="seg seg--cards">
            <legend className="visually-hidden">Спосіб отримання</legend>
            {(quote?.deliveryMethods ?? []).map((d) => (
              <span key={d.code}>
                <input type="radio" id={`delivery-${d.code}`} name="delivery" value={d.code} checked={delivery === d.code} onChange={() => setDelivery(d.code)} />
                <label htmlFor={`delivery-${d.code}`}>
                  <b>{d.name}</b>
                  <small>{deliveryHint[d.code] ?? ""}</small>
                </label>
              </span>
            ))}
          </fieldset>

          {delivery === "nova_poshta_courier" ? (
            <>
              <div className="fields-2">
                <SettlementPicker value={settlement} onChange={chooseSettlement} error={errors["delivery.settlementRef"]} />
                <div className="field">
                  <label htmlFor="street">Вулиця</label>
                  <input id="street" name="street" autoComplete="address-line1" maxLength={150} required {...field("delivery.address.street")} />
                  {fieldError("delivery.address.street")}
                </div>
              </div>
              <div className="fields-2">
                <div className="field">
                  <label htmlFor="house">Будинок</label>
                  <input id="house" name="house" autoComplete="off" maxLength={20} required {...field("delivery.address.house")} />
                  {fieldError("delivery.address.house")}
                </div>
                <div className="field">
                  <label htmlFor="apartment">Квартира, якщо є</label>
                  <input id="apartment" name="apartment" autoComplete="address-line2" maxLength={20} {...field("delivery.address.apartment")} />
                  {fieldError("delivery.address.apartment")}
                </div>
              </div>
            </>
          ) : delivery === "nova_poshta" ? (
            <div className="fields-2">
              <SettlementPicker value={settlement} onChange={chooseSettlement} error={errors["delivery.settlementRef"]} />
              <div className="field">
                <label htmlFor="warehouse">Відділення або поштомат</label>
                <select
                  id="warehouse"
                  value={warehouseRef}
                  onChange={(e) => setWarehouseRef(e.target.value)}
                  disabled={!settlement}
                  {...field("delivery.warehouseRef")}
                >
                  <option value="">{settlement ? "Оберіть зі списку" : "Спершу оберіть місто"}</option>
                  {["branch", "postomat"].map((type) => {
                    const list = warehouses.filter((w) => w.type === type);
                    return list.length ? (
                      <optgroup key={type} label={type === "branch" ? "Відділення" : "Поштомати"}>
                        {list.map((w) => (
                          <option key={w.ref} value={w.ref}>
                            {w.name}, {w.address}
                          </option>
                        ))}
                      </optgroup>
                    ) : null;
                  })}
                </select>
                {fieldError("delivery.warehouseRef")}
              </div>
            </div>
          ) : (
            <p className="notice">
              <strong>Самовивіз з магазину в Бучі</strong>
              Адресу й графік менеджер підтвердить, коли замовлення буде готове.
            </p>
          )}
          {quote && <p className="field__help">{quote.deliveryNote}</p>}
        </section>

        <section aria-labelledby="payment-title">
          <h2 id="payment-title">
            <span>3</span> Оплата
          </h2>
          <fieldset className="seg seg--cards">
            <legend className="visually-hidden">Спосіб оплати</legend>
            {paymentOptions.map((p) => (
              <span key={p.code}>
                <input type="radio" id={`payment-${p.code}`} name="payment" value={p.code} checked={effectivePayment === p.code} onChange={() => setPayment(p.code)} />
                <label htmlFor={`payment-${p.code}`}>
                  <b>{p.name}</b>
                  <small>{p.code === "card" ? "Після створення замовлення" : "Під час отримання"}</small>
                </label>
              </span>
            ))}
          </fieldset>
          {fieldError("payment.method")}
        </section>

        <section aria-labelledby="comment-title">
          <h2 id="comment-title">
            <span>4</span> Коментар
          </h2>
          <div className="field">
            <label htmlFor="comment" className="visually-hidden">
              Коментар до замовлення
            </label>
            <textarea id="comment" name="comment" autoComplete="off" maxLength={1000} placeholder="Наприклад, зручний час для дзвінка…" {...field("comment")} />
            {fieldError("comment")}
          </div>
          <label className="consent">
            <input type="checkbox" name="acceptOffer" required {...field("acceptOffer")} />
            <span>
              Погоджуюся з{" "}
              <Link href="/offer" className="link" target="_blank">
                публічною офертою
              </Link>{" "}
              і{" "}
              <Link href="/privacy" className="link" target="_blank">
                політикою приватності
              </Link>
            </span>
          </label>
          {fieldError("acceptOffer")}
        </section>
      </div>

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
    </form>
  );
}
