import { formatDateTime } from "@polivalko/shared/lib/format";
import type { ImportRun } from "../lib/types";

const runStatus: Record<string, string> = {
  running: "Виконується",
  succeeded: "Успішно",
  partiallySucceeded: "З помилками",
  failed: "Не виконано",
};

export function ImportRunReport({ run, open = false }: { run: ImportRun; open?: boolean }) {
  return (
    <details className="console-panel" open={open} style={{ marginTop: "var(--space-sm)" }}>
      <summary>
        <strong>{runStatus[run.status] ?? run.status}</strong>, {formatDateTime(run.startedAt)}, {run.startedBy}. {run.summary}
      </summary>
      {run.errors.length > 0 && (
        <div className="console-table-wrap" style={{ marginTop: "var(--space-sm)" }}>
          <table className="console-table">
            <thead>
              <tr>
                <th scope="col">Рядок або артикул</th>
                <th scope="col">Помилка</th>
              </tr>
            </thead>
            <tbody>
              {run.errors.map((e, i) => (
                <tr key={i}>
                  <td className="code">{e.item ?? "—"}</td>
                  <td>{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {run.errorCount > run.errors.length && <p className="muted">Показано {run.errors.length} з {run.errorCount} помилок.</p>}
        </div>
      )}
    </details>
  );
}
