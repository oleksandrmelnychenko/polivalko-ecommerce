"use client";

import { useEffect, useRef, useState } from "react";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import { startPayment } from "../api/client";
import { paymentPageUrl } from "../lib/payment-url";

type StartResult = { data?: { pageUrl: string }; error?: unknown };

type PayButtonProps = {
  number: string;
  token?: string;
  failed: boolean;
  amount: string;
  start?: (idempotencyKey: string) => Promise<StartResult>;
};

export function PayButton(props: PayButtonProps) {
  return <OrderPayButton key={JSON.stringify([props.number, props.token])} {...props} />;
}

function OrderPayButton({ number, token = "", failed, amount, start }: PayButtonProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);
  const operation = useRef<symbol | null>(null);

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

  async function pay() {
    if (operation.current) return;
    const request = Symbol();
    operation.current = request;
    setBusy(true);
    setError(null);
    let leaving = false;
    try {
      key.current ??= newIdempotencyKey();
      const { data, error } = await (start ? start(key.current) : startPayment(number, token, key.current));
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
      setError(problem?.title ?? "Не вдалося відкрити оплату. Спробуйте ще раз.");
    } catch {
      if (operation.current === request) setError("Немає зв'язку з сервером. Перевірте інтернет і спробуйте ще раз.");
    } finally {
      if (!leaving && operation.current === request) {
        operation.current = null;
        setBusy(false);
      }
    }
  }

  return (
    <section className="pay" aria-labelledby="pay-title">
      <h2 id="pay-title">{failed ? "Оплата не пройшла" : "Оплатіть замовлення карткою"}</h2>
      <p>
        {failed
          ? "Оплату не підтверджено. Перевірте статус платежу у своєму банку перед повторною спробою. Якщо кошти списано, зверніться до магазину."
          : "Відкриється захищена сторінка платіжної системи. Статус оплати оновиться тут автоматично."}
      </p>
      <div className="pay__actions">
        <button type="button" className="btn" onClick={pay} disabled={busy} aria-busy={busy}>
          {failed ? "Спробувати ще раз:" : "Оплатити"} <span className="money">{amount}</span>
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
