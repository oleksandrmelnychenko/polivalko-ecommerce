"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData, useStaff } from "@/lib/admin";
import { StateBox } from "../ui";
import { problemOf, problemText, when, withCsrf } from "../content/_lib";
import { ErrorText, Failures } from "./_lib";
import { NovaPoshtaSection } from "./novaposhta";
import { OutboxSection } from "./outbox";
import { RunsSection } from "./runs";

type Job = components["schemas"]["SyncJobDto"];
type RunRequest = { busy?: boolean; accepted?: boolean; error?: string };

const navkoloModeLabel: Record<string, string> = {
  Disabled: "вимкнено: ціни й залишки приходять з імпорту файлів",
  Stub: "тестова заглушка: обмін з Navkolo імітується",
};

/** Імпорт файлом запускає людина на сторінці імпорту, а не Worker за розкладом. */
const FILE_IMPORT_JOB = "navkolo.import";

/** Запит на запуск ще не підхопив Worker. */
const waitsForWorker = (j: Job) =>
  j.runRequestedAt !== null && (j.lastAttemptAt === null || Date.parse(j.runRequestedAt) > Date.parse(j.lastAttemptAt));

export default function AdminIntegrationPage() {
  return (
    <Suspense fallback={null}>
      <Integration />
    </Suspense>
  );
}

function Integration() {
  const { isAdmin } = useStaff();
  const status = useAdminData("integration", () => browserApi.GET("/api/v1/admin/integration/status"));
  const [requests, setRequests] = useState<Record<string, RunRequest>>({});

  async function run(job: string) {
    setRequests((r) => ({ ...r, [job]: { busy: true } }));
    let next: RunRequest;
    try {
      const result = await withCsrf((headers) => browserApi.POST("/api/v1/admin/integration/jobs/{job}/run", { params: { path: { job } }, headers }));
      next = result.response.ok ? { accepted: true } : { error: problemText(problemOf(result), "Запит не прийнято.") };
      if (result.response.ok) status.reload();
    } catch {
      next = { error: "Немає зв'язку з сервером." };
    }
    setRequests((r) => ({ ...r, [job]: next }));
  }

  function refresh() {
    setRequests({});
    status.reload();
  }

  const s = status.data;

  return (
    <>
      <div className="admin-head">
        <h1 className="admin-title">Інтеграції</h1>
        <Link href="/admin/catalog/import" className="link">
          Імпорт каталогу з файлу
        </Link>
      </div>

      <StateBox state={status}>
        {s && (
          <>
            {!s.catalogDataFresh && (
              <div className="notice notice--error admin-notice" role="status">
                <strong>Ціни й залишки застаріли</strong>
                Нові замовлення приймаються як заявки без онлайн-оплати й без резерву: менеджер підтверджує ціну й наявність вручну. Онлайн-оплата
                повернеться після вдалої синхронізації цін і залишків з Navkolo.
              </div>
            )}
            <dl className="buybox__meta admin-meta">
              <dt>Режим Navkolo</dt>
              <dd>{navkoloModeLabel[s.navkoloMode] ?? s.navkoloMode}</dd>
              <dt>Ціни й залишки</dt>
              <dd>{s.catalogDataFresh ? "актуальні, онлайн-оплата доступна" : <span className="admin-bad">застарілі, замовлення йдуть як заявки</span>}</dd>
              <dt>Черга операцій</dt>
              <dd>
                {s.outboxPending} чекають виконання, {s.outboxFailed > 0 ? <span className="admin-bad">{s.outboxFailed} не виконано</span> : "невиконаних немає"}
              </dd>
            </dl>

            <section className="admin-section" aria-labelledby="jobs-title">
              <div className="admin-section__head">
                <h2 id="jobs-title">Фонові завдання</h2>
                <button type="button" className="btn btn--small btn--quiet" onClick={refresh}>
                  Оновити
                </button>
              </div>
              <div className="admin-table-wrap">
                <table className="admin-table" aria-labelledby="jobs-title">
                  <thead>
                    <tr>
                      <th scope="col">Завдання</th>
                      <th scope="col">Остання спроба</th>
                      <th scope="col">Останній успіх</th>
                      <th scope="col" className="num">
                        Збоїв поспіль
                      </th>
                      <th scope="col">Остання помилка</th>
                      <th scope="col">Запуск</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.jobs.map((j) => (
                      <tr key={j.job}>
                        <td>
                          {j.title}
                          <br />
                          <span className="code">{j.job}</span>
                        </td>
                        <td>{when(j.lastAttemptAt)}</td>
                        <td>{when(j.lastSuccessAt)}</td>
                        <td className="num">
                          <Failures count={j.consecutiveFailures} />
                        </td>
                        <td>
                          <ErrorText text={j.lastError} />
                        </td>
                        <td>
                          <RunCell job={j} request={requests[j.job]} canRun={isAdmin} onRun={() => run(j.job)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </StateBox>

      <RunsSection jobs={s?.jobs ?? []} />
      {/* Черга й довідник Нової пошти в API доступні лише адміністратору. */}
      {isAdmin && <OutboxSection onRetried={status.reload} />}
      {isAdmin && <NovaPoshtaSection />}
    </>
  );
}

function RunCell({ job, request, canRun, onRun }: { job: Job; request?: RunRequest; canRun: boolean; onRun: () => void }) {
  if (job.job === FILE_IMPORT_JOB)
    return (
      <Link href="/admin/catalog/import" className="link">
        Завантажити файл
      </Link>
    );
  if (request?.accepted)
    return (
      <span role="status" className="admin-small">
        Запит прийнято, Worker виконає протягом хвилини.
      </span>
    );
  if (waitsForWorker(job)) return <span className="muted admin-small">Запит від {when(job.runRequestedAt)} чекає Worker.</span>;
  if (!canRun) return <span className="muted">за розкладом</span>;
  return (
    <>
      <button type="button" className="btn btn--quiet" disabled={request?.busy} aria-busy={request?.busy} onClick={onRun}>
        Запустити зараз
      </button>
      {request?.error && (
        <p className="field__error" role="alert">
          {request.error}
        </p>
      )}
    </>
  );
}
