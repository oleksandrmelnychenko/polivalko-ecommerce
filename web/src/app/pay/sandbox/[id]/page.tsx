"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { browserApi, type Problem } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { formatMoney } from "@/lib/format";

type Invoice = components["schemas"]["SandboxInvoiceDto"];
type Outcome = "success" | "failure" | "expired";

/**
 * Сторінка тестової платіжної системи (Payments:Provider=Sandbox). Карткових даних не збирає:
 * обраний результат сервер перетворює на підписаний вебхук і проводить тим самим шляхом,
 * що й повідомлення справжнього провайдера.
 */
export default function SandboxPaymentPage() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void browserApi.GET("/api/v1/payments/sandbox/{invoiceId}", { params: { path: { invoiceId: id } } }).then(({ data }) => {
      if (!cancelled) setInvoice(data ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function complete(outcome: Outcome, notify = true) {
    setBusy(outcome);
    setError(null);
    const { data, error: problem } = await browserApi.POST("/api/v1/payments/sandbox/{invoiceId}/complete", {
      params: { path: { invoiceId: id } },
      body: { outcome, notify },
    });
    if (data) {
      window.location.assign(data.redirectUrl);
      return;
    }
    setBusy(null);
    setError((problem as Problem | undefined)?.title ?? "Тестову оплату не проведено.");
  }

  if (invoice === undefined) return <div className="paypage__card skeleton" style={{ height: "20rem" }} aria-busy="true" />;
  if (invoice === null)
    return (
      <div className="paypage__card">
        <h1>Рахунок не знайдено</h1>
        <p>Посилання застаріло або тестова оплата вимкнена.</p>
      </div>
    );

  const open = invoice.status === "created" || invoice.status === "processing";

  return (
    <div className="paypage__card">
      <h1>Тестова оплата</h1>
      <p className="paypage__amount">
        <span className="code">{formatMoney(invoice.amount)}</span>
      </p>
      <p>
        Оплата замовлення <span className="code">{invoice.orderNumber}</span>. Тут не потрібні дані картки: оберіть, чим
        закінчиться оплата, і повернетеся до магазину.
      </p>
      {open ? (
        <div className="paypage__actions">
          <button type="button" className="btn" onClick={() => complete("success")} disabled={busy !== null} aria-busy={busy === "success"}>
            Оплата успішна
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => complete("failure")} disabled={busy !== null} aria-busy={busy === "failure"}>
            Банк відмовив
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => complete("expired")} disabled={busy !== null} aria-busy={busy === "expired"}>
            Час вийшов
          </button>
          <details className="paypage__more">
            <summary>Для перевірки збоїв</summary>
            <button type="button" className="btn btn--quiet btn--small" onClick={() => complete("success", false)} disabled={busy !== null}>
              Успіх без вебхука
            </button>
            <p className="field__help">Статус підхопить фонова звірка Worker протягом кількох хвилин.</p>
          </details>
        </div>
      ) : (
        <p className="notice">Рахунок уже закрито: {invoice.status}.</p>
      )}
      {error && (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
