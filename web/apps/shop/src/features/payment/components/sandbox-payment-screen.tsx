"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Problem } from "@polivalko/shared/api/problem";
import type { components } from "@polivalko/shared/api/schema";
import { formatMoney } from "@polivalko/shared/lib/format";
import { completeSandboxInvoice, getSandboxInvoice } from "../api/client";
import { sandboxReturnUrl } from "../lib/payment-url";

type Invoice = components["schemas"]["SandboxInvoiceDto"];
type Outcome = "success" | "failure" | "expired";

export function SandboxPaymentScreen() {
  const { id } = useParams<{ id: string }>();
  return <SandboxInvoiceScreen key={id} id={id} />;
}

function SandboxInvoiceScreen({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null | undefined>(undefined);
  const [busy, setBusy] = useState<Outcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const operation = useRef<symbol | null>(null);

  useEffect(() => {
    let pending: AbortController;
    function load() {
      pending?.abort();
      const controller = new AbortController();
      pending = controller;
      const failed = () => {
        setError("Не вдалося завантажити рахунок. Оновіть сторінку.");
        setInvoice(null);
      };
      void getSandboxInvoice(id, controller.signal).then(({ data, response }) => {
        if (controller.signal.aborted) return;
        if (!data && response.status !== 404) failed();
        else setInvoice(data ?? null);
      }).catch(() => {
        if (!controller.signal.aborted) failed();
      });
    }
    function restored(event: PageTransitionEvent) {
      if (!event.persisted) return;
      operation.current = null;
      setBusy(null);
      setError(null);
      setInvoice(undefined);
      load();
    }
    load();
    window.addEventListener("pageshow", restored);
    return () => {
      pending.abort();
      operation.current = null;
      window.removeEventListener("pageshow", restored);
    };
  }, [id]);

  async function complete(outcome: Outcome, notify = true) {
    if (!invoice || operation.current) return;
    const request = Symbol();
    operation.current = request;
    setBusy(outcome);
    setError(null);
    let leaving = false;
    try {
      const { data, error: problem } = await completeSandboxInvoice(id, outcome, notify);
      if (operation.current !== request) return;
      if (data) {
        const destination = sandboxReturnUrl(data.redirectUrl, window.location.origin, invoice.orderNumber);
        if (!destination) {
          setError("Платіжна система повернула некоректне посилання.");
          return;
        }
        window.location.assign(destination);
        leaving = true;
        return;
      }
      setError((problem as Problem | undefined)?.title ?? "Тестову оплату не проведено.");
    } catch {
      if (operation.current === request) setError("Не вдалося зв’язатися із сервером. Перевірте статус замовлення.");
    } finally {
      if (!leaving && operation.current === request) {
        operation.current = null;
        setBusy(null);
      }
    }
  }

  if (invoice === undefined) return <div className="paypage__card skeleton" style={{ height: "20rem" }} aria-busy="true" />;
  if (invoice === null)
    return (
      <div className="paypage__card">
        <h1>Рахунок не знайдено</h1>
        {error ? <p role="alert">{error}</p> : <p>Посилання застаріло або тестова оплата вимкнена.</p>}
      </div>
    );

  const open = invoice.status === "created" || invoice.status === "processing";

  return (
    <div className="paypage__card">
      <h1>Тестова оплата</h1>
      <p className="paypage__amount">
        <span className="code"><span className="money">{formatMoney(invoice.amount)}</span></span>
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
