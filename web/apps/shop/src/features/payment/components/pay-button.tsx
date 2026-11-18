"use client";

import { useEffect, useRef, useState } from "react";
import { newIdempotencyKey } from "@polivalko/shared/api/browser";
import type { Problem } from "@polivalko/shared/api/problem";
import { startPayment } from "../api/client";

type StartResult = { data?: { pageUrl: string }; error?: unknown };

export function PayButton({
  number,
  token = "",
  failed,
  amount,
  start,
}: {
  number: string;
  token?: string;
  failed: boolean;
  amount: string;
  start?: (idempotencyKey: string) => Promise<StartResult>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const key = useRef<string | null>(null);

  useEffect(() => {
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      key.current = null;
      setBusy(false);
    };
    window.addEventListener("pageshow", restored);
    return () => window.removeEventListener("pageshow", restored);
  }, []);

  async function pay() {
    setBusy(true);
    setError(null);
    key.current ??= newIdempotencyKey();
    try {
      const { data, error: problem } = await (start ? start(key.current) : startPayment(number, token, key.current));
      if (data) {
        window.location.assign(data.pageUrl);
        return;
      }
      key.current = null;
      setError((problem as Problem | undefined)?.title ?? "Не вдалося відкрити оплату. Спробуйте ще раз.");
    } catch {
      setError("Немає зв'язку з сервером. Перевірте інтернет і спробуйте ще раз.");
    }
    setBusy(false);
  }

  return (
    <section className="pay" aria-labelledby="pay-title">
      <h2 id="pay-title">{failed ? "Оплата не пройшла" : "Оплатіть замовлення карткою"}</h2>
      <p>
        {failed
          ? "Гроші не списано. Спробуйте ще раз іншою карткою або зверніться до менеджера."
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
