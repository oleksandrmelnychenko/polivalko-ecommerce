"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { when } from "@/shared/format";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { plural } from "@polivalko/shared/lib/format";
import { getRuns } from "../api/client";
import { runStatusLabel } from "../lib/labels";
import type { Job } from "../lib/types";

export function IntegrationRuns({ jobs }: { jobs: Job[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const job = params.get("job") ?? "";
  const runs = useConsoleData(`runs|${job}`, () => getRuns(job || undefined));
  const titles = new Map(jobs.map((j) => [j.job, j.title]));

  const choose = (value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set("job", value);
    else next.delete("job");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <section className="console-section" aria-labelledby="runs-title">
      <div className="console-section__head">
        <h2 id="runs-title">Останні запуски</h2>
      </div>
      <div className="console-filters">
        <div className="field">
          <label htmlFor="runs-job">Завдання</label>
          <select id="runs-job" value={job} onChange={(e) => choose(e.target.value)}>
            <option value="">Усі</option>
            {jobs.map((j) => (
              <option key={j.job} value={j.job}>
                {j.title}
              </option>
            ))}
            {job && !titles.has(job) && <option value={job}>{job}</option>}
          </select>
        </div>
      </div>
      <StateBox state={runs} empty={runs.data?.length === 0 ? (job ? "Це завдання ще не запускалося." : "Запусків ще не було.") : undefined}>
        {runs.data && (
          <div className="console-table-wrap">
            <table className="console-table" aria-labelledby="runs-title">
              <thead>
                <tr>
                  <th scope="col">Завдання</th>
                  <th scope="col">Почато</th>
                  <th scope="col">Завершено</th>
                  <th scope="col">Результат</th>
                  <th scope="col">Хто запустив</th>
                  <th scope="col">Підсумок</th>
                  <th scope="col">Помилки</th>
                </tr>
              </thead>
              <tbody>
                {runs.data.map((r) => (
                  <tr key={r.id}>
                    <td>{titles.get(r.job) ?? <span className="code">{r.job}</span>}</td>
                    <td>{when(r.startedAt)}</td>
                    <td>{r.finishedAt ? when(r.finishedAt) : <span className="muted">ще триває</span>}</td>
                    <td>
                      <span className={r.status === "failed" || r.status === "partiallySucceeded" ? "status console-bad" : "status"}>{runStatusLabel[r.status]}</span>
                    </td>
                    <td>{r.startedBy}</td>
                    <td>{r.summary ?? <span className="muted">немає</span>}</td>
                    <td>
                      {r.errorCount === 0 ? (
                        <span className="muted">немає</span>
                      ) : (
                        <details className="console-details">
                          <summary className="console-bad">
                            {r.errorCount} {plural(r.errorCount, "помилка", "помилки", "помилок")}
                          </summary>
                          <ol className="console-errors">
                            {r.errors.map((e, i) => (
                              <li key={i}>
                                {e.item && <span className="code">{e.item}</span>} {e.message}
                              </li>
                            ))}
                          </ol>
                          {r.errors.length < r.errorCount && (
                            <p className="muted console-small">
                              Показано {r.errors.length} з {r.errorCount}.
                            </p>
                          )}
                        </details>
                      )}
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
