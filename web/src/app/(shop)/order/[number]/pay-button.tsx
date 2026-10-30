"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { browserApi, newIdempotencyKey, type Problem } from "@/lib/api/browser";

/**
 * Відкриває оплату карткою: сервер створює рахунок у провайдера й повертає його сторінку.
 * Повторне натискання після відмови відкриває нову спробу (розділ 6 ТЗ).
 */
export function PayButton({ number, token, failed, amount }: { number: string; token: string; failed: boolean; amount: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Один ключ на натискання: повтор після обриву зв'язку не відкриває другу спробу.
  const key = useRef<string | null>(null);

  async function pay() {
    setBusy(true);
    setError(null);
    key.current ??= newIdempotencyKey();
    const { data, error: problem } = await browserApi.POST("/api/v1/orders/{number}/payments", {
      params: { path: { number }, header: { "Idempotency-Key": key.current } },
      body: { token },
    });
    if (data) {
      window.location.assign(data.pageUrl);
      return;
    }
    key.current = null;
    setBusy(false);
    setError((problem as Problem | undefined)?.title ?? "Не вдалося відкрити оплату. Спробуйте ще раз.");
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
          {failed ? `Спробувати ще раз: ${amount}` : `Оплатити ${amount}`}
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

/**
 * Після повернення зі сторінки оплати статус може ще чекати вебхука провайдера:
 * кілька разів оновлюємо сторінку, доки сервер не отримає підтвердження.
 */
export function PaymentPending() {
  const router = useRouter();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (attempt >= 10) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempt((n) => n + 1);
    }, 2000);
    return () => clearTimeout(timer);
  }, [attempt, router]);

  return (
    <section className="pay" aria-live="polite">
      <h2>Перевіряємо оплату</h2>
      <p>
        {attempt < 10
          ? "Чекаємо підтвердження від платіжної системи. Це займає кілька секунд."
          : "Підтвердження ще не надійшло. Оновіть сторінку трохи пізніше: якщо гроші списано, статус зміниться автоматично."}
      </p>
    </section>
  );
}
