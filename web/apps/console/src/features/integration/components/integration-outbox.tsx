"use client";

import { useState } from "react";
import { withCsrf } from "@/shared/csrf";
import { when } from "@/shared/format";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { problemOf, problemText } from "@polivalko/shared/api/problem";
import type { components } from "@polivalko/shared/api/schema";
import { getOutbox, retryOutbox } from "../api/client";
import { messageTypeLabel } from "../lib/labels";
import { ErrorText } from "./error-text";

type Message = components["schemas"]["OutboxMessageDto"];

export function IntegrationOutbox({ onRetried }: { onRetried: () => void }) {
  const outbox = useConsoleData("outbox", () => getOutbox());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  async function retry(m: Message) {
    setBusy(m.id);
    setNotice(null);
    const label = messageTypeLabel[m.type] ?? m.type;
    try {
      const result = await withCsrf((headers) => retryOutbox(headers, m.id));
      if (result.response.ok) {
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
    <section className="console-section" aria-labelledby="outbox-title">
      <div className="console-section__head">
        <h2 id="outbox-title">Черга операцій</h2>
      </div>
      {notice && (
        <p className={notice.ok ? "notice notice--ok console-notice" : "notice notice--error console-notice"} role={notice.ok ? "status" : "alert"}>
          {notice.text}
        </p>
      )}
      <StateBox state={outbox} empty={outbox.data?.length === 0 ? "Невдалих і відкладених операцій немає." : undefined}>
        {outbox.data && (
          <div className="console-table-wrap">
            <table className="console-table" aria-labelledby="outbox-title">
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
                    <td>{m.status === "failed" ? <span className="status console-bad">Не виконано</span> : <span className="status">Повтор за розкладом</span>}</td>
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
