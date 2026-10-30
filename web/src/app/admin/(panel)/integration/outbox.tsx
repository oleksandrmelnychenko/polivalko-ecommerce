"use client";

import { useState } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { StateBox } from "../ui";
import { problemOf, problemText, when, withCsrf } from "../content/_lib";
import { ErrorText } from "./_lib";

type Message = components["schemas"]["OutboxMessageDto"];

const messageTypeLabel: Record<string, string> = {
  "ordering.order-placed": "Сповіщення про нове замовлення",
  "ordering.export-requested": "Передача замовлення в Navkolo",
  "ordering.payment-succeeded": "Обробка успішної оплати",
  "ordering.refund-requested": "Повернення коштів",
  "ordering.fiscal-receipt-requested": "Фіскальний чек",
  "content.service-request-submitted": "Сповіщення про заявку на послугу",
  "integration.alert": "Сповіщення про збій інтеграції",
};

/** Невдалі й відкладені операції черги з ручним повтором (лише адміністратор). */
export function OutboxSection({ onRetried }: { onRetried: () => void }) {
  const outbox = useAdminData("outbox", () => browserApi.GET("/api/v1/admin/integration/outbox"));
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function retry(m: Message) {
    setBusy(m.id);
    setNotice(null);
    const label = messageTypeLabel[m.type] ?? m.type;
    try {
      const result = await withCsrf((headers) => browserApi.POST("/api/v1/admin/integration/outbox/{id}/retry", { params: { path: { id: m.id } }, headers }));
      if (result.response.ok) {
        // Повторена операція знову чекає з нулем спроб і зникає зі списку невдалих.
        setNotice({ ok: true, text: `«${label}» поставлено в чергу повторно. Worker виконає протягом хвилини.` });
        outbox.reload();
        onRetried();
      } else {
        setNotice({ ok: false, text: problemText(problemOf(result), "Повтор не прийнято.") });
      }
    } catch {
      setNotice({ ok: false, text: "Немає зв'язку з сервером." });
    }
    setBusy(null);
  }

  return (
    <section className="admin-section" aria-labelledby="outbox-title">
      <div className="admin-section__head">
        <h2 id="outbox-title">Черга операцій</h2>
      </div>
      {notice && (
        <p className={notice.ok ? "notice notice--ok admin-notice" : "notice notice--error admin-notice"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}
      <StateBox state={outbox} empty={outbox.data?.length === 0 ? "Невдалих і відкладених операцій немає." : undefined}>
        {outbox.data && (
          <div className="admin-table-wrap">
            <table className="admin-table" aria-labelledby="outbox-title">
              <thead>
                <tr>
                  <th scope="col">Операція</th>
                  <th scope="col">Виникла</th>
                  <th scope="col">Стан</th>
                  <th scope="col" className="num">
                    Спроб
                  </th>
                  <th scope="col">Наступна спроба</th>
                  <th scope="col">Остання помилка</th>
                  <th scope="col">
                    <span className="visually-hidden">Дія</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {outbox.data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {messageTypeLabel[m.type] ?? m.type}
                      <br />
                      <span className="code">{m.type}</span>
                    </td>
                    <td>{when(m.occurredAt)}</td>
                    <td>{m.status === "failed" ? <span className="status admin-bad">Не виконано</span> : <span className="status">Повтор за розкладом</span>}</td>
                    <td className="num">{m.attempts}</td>
                    <td>{m.status === "failed" ? <span className="muted">спроби вичерпано</span> : when(m.nextAttemptAt)}</td>
                    <td>
                      <ErrorText text={m.lastError} />
                    </td>
                    <td>
                      <button type="button" className="btn btn--quiet" disabled={busy !== null} aria-busy={busy === m.id} onClick={() => retry(m)}>
                        Повторити
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StateBox>
    </section>
  );
}
