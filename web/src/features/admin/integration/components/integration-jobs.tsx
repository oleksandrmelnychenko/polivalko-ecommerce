import Link from "next/link";
import { when } from "@/shared/admin/format";
import { FILE_IMPORT_JOB, waitsForWorker } from "../lib/labels";
import type { Job } from "../lib/types";
import { ErrorText, Failures } from "./error-text";

export type RunRequest = { busy?: boolean; accepted?: boolean; error?: string };

export function IntegrationJobs({
  jobs,
  requests,
  canRun,
  onRun,
  onRefresh,
}: {
  jobs: Job[];
  requests: Record<string, RunRequest>;
  canRun: boolean;
  onRun: (job: string) => void;
  onRefresh: () => void;
}) {
  return (
    <section className="admin-section" aria-labelledby="jobs-title">
      <div className="admin-section__head">
        <h2 id="jobs-title">Фонові завдання</h2>
        <button type="button" className="btn btn--small btn--quiet" onClick={onRefresh}>
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
            {jobs.map((j) => (
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
                  <RunCell job={j} request={requests[j.job]} canRun={canRun} onRun={() => onRun(j.job)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
