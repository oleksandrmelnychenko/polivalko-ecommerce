"use client";

import { useEffect, useRef, useState } from "react";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import { getPaymentOptions, startPayment } from "../api/client";
import { paymentPageUrl } from "../lib/payment-url";

type StartResult = { data?: { pageUrl: string }; error?: unknown };

type PaymentOption = { code: string; name: string; hint: string };

type PayButtonProps = {
  number: string;
  token?: string;
  failed: boolean;
  amount: string;
  start?: (idempotencyKey: string, method: string | null) => Promise<StartResult>;
};

export function PayButton(props: PayButtonProps) {
  return <OrderPayButton key={JSON.stringify([props.number, props.token])} {...props} />;
}

/** The bank picked at checkout travels to the order page as ?pay=…; it stays a suggestion the buyer can change. */
function suggestedMethod(): string | null {
  return new URLSearchParams(window.location.search).get("pay");
}

function OrderPayButton({ number, token = "", failed, amount, start }: PayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [options, setOptions] = useState<PaymentOption[]>([]);
  const [method, setMethod] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const operation = useRef<symbol | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPaymentOptions(controller.signal)
      .then(({ data }) => {
        if (!data) return;
        setOptions(data);
        const suggested = suggestedMethod();
        setMethod((current) => current ?? (data.find((o) => o.code === suggested) ?? data[0])?.code ?? null);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      key.current = null;
      operation.current = null;
      setBusy(false);
    };
    window.addEventListener("pageshow", restored);
    return () => {
      key.current = null;
      operation.current = null;
      window.removeEventListener("pageshow", restored);
    };
  }, []);

  function choose(code: string) {
    if (busy) return;
    // Another bank is another request: it needs its own idempotency key.
    key.current = null;
    setError(null);
    setMethod(code);
  }

  async function pay() {
    if (operation.current) return;
    const request = Symbol();
    operation.current = request;
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      key.current ??= newIdempotencyKey();
      const { data, error } = await (start ? start(key.current, method) : startPayment(number, token, key.current, method));
      if (operation.current !== request) return;
      if (data) {
        const destination = paymentPageUrl(data.pageUrl, window.location.origin);
        if (!destination) {
          setError("Платіжна система повернула некоректне посилання.");
          return;
        }
        window.location.assign(destination);
        leaving = true;
        return;
      }
      const problem = error as Problem | undefined;
      if (problem?.code !== "idempotency.in_progress") key.current = null;
      setError(problem?.detail && problem.code === "payments.in_progress" ? `${problem.title}. ${problem.detail}` : (problem?.title ?? "Не вдалося відкрити оплату. Спробуйте ще раз."));
    } catch {
      if (operation.current === request) setError("Немає зв'язку з сервером. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      if (!leaving && operation.current === request) {
        operation.current = null;
        setBusy(false);
      }
    }
  }

  const chosen = options.find((o) => o.code === method);

  return (
    <section className="pay" aria-labelledby="pay-title">
      <h2 id="pay-title">{failed ? "Оплата не пройшла" : "Оплатіть замовлення онлайн"}</h2>
      <p>
        {failed
          ? "Оплату не підтверджено. Перевірте статус платежу у своєму банку перед повторною спробою. Якщо кошти списано, зверніться до магазину."
          : "Відкриється захищена сторінка банку. Статус оплати оновиться тут автоматично."}
      </p>
      {options.length > 1 && (
        <fieldset className="pay__methods">
          <legend>Спосіб оплати</legend>
          {options.map((option) => (
            <label key={option.code} className="pay__method">
              <input type="radio" name={`pay-method-${number}`} value={option.code} checked={method === option.code} disabled={busy} onChange={() => choose(option.code)} />
              <span>
                <b>{option.name}</b>
                <small>{option.hint}</small>
              </span>
            </label>
          ))}
        </fieldset>
      )}
      <div className="pay__actions">
        <button type="button" className="btn" onClick={pay} disabled={busy} aria-busy={busy}>
          {failed ? "Спробувати ще раз:" : chosen && options.length > 1 ? `Оплатити через ${chosen.name}` : "Оплатити"} <span className="money">{amount}</span>
        </button>
      </div>
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
