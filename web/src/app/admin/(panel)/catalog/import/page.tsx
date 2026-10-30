"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { browserApi, type Problem } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { csrfHeader, forgetCsrf, useAdminData } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { StateBox } from "../../ui";
import { AdminOnly, CatalogTabs } from "../_shared";

type Run = components["schemas"]["ImportRunDto"];

const runStatus: Record<string, string> = {
  running: "Виконується",
  succeeded: "Успішно",
  partiallySucceeded: "З помилками",
  failed: "Не виконано",
};

/**
 * Первинний імпорт каталогу з файлу замовника (розділ 7 ТЗ): перевірка формату, обов'язкових полів,
 * дублікатів і груп зі звітом помилок. Ціни й залишки далі оновлює синхронізація з Navkolo.
 */
export default function AdminImportPage() {
  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <AdminOnly>
        <Import />
      </AdminOnly>
    </>
  );
}

function Import() {
  const runs = useAdminData("import-runs", () => browserApi.GET("/api/v1/admin/integration/runs", { params: { query: { job: "navkolo.import" } } }));
  const [result, setResult] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setError("Оберіть файл JSON або CSV.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    const send = async () => fetch("/api/v1/admin/integration/navkolo/import", { method: "POST", body: data, headers: await csrfHeader() });
    let response = await send();
    if (response.status === 400 && ((await response.clone().json().catch(() => null)) as Problem | null)?.code === "auth.csrf_invalid") {
      forgetCsrf();
      response = await send();
    }
    setBusy(false);
    if (response.ok) {
      setResult((await response.json()) as Run);
      runs.reload();
    } else {
      const problem = (await response.json().catch(() => null)) as Problem | null;
      setError(problem?.errors?.file?.[0] ?? problem?.title ?? "Імпорт не виконано.");
    }
  }

  return (
    <>
      <div className="admin-columns">
        <form className="admin-form" onSubmit={upload}>
          <div className="field">
            <label htmlFor="file">Файл каталогу</label>
            <input id="file" name="file" type="file" accept=".json,.csv,application/json,text/csv" aria-describedby="file-help" />
            <p id="file-help" className="field__help">
              CSV з колонками <span className="code">navkolo_id; sku; name; group; price; old_price; stock; brand; variant_group; variant_label; description</span>{" "}
              або JSON-масив тих самих полів. До 20 МБ.
            </p>
          </div>
          <div className="admin-actions">
            <button type="submit" className="btn btn--small" disabled={busy} aria-busy={busy}>
              {busy ? "Імпортуємо…" : "Імпортувати"}
            </button>
          </div>
          {error && (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          )}
        </form>
        <aside className="admin-panel">
          <h2>Що перезаписується</h2>
          <p className="field__help">
            Артикул, назва з обліку, група, ціна, стара ціна й залишок. Опис, фото, характеристики, назва для вітрини й
            видимість задаються лише для нових товарів і далі не змінюються імпортом. Товари групи «Хлам» імпортуються
            прихованими. Групу з товарами без розділу на сайті прив&apos;яжіть у{" "}
            <Link href="/admin/catalog/categories" className="link">
              розділах
            </Link>
            .
          </p>
        </aside>
      </div>

      {result && <RunReport run={result} open />}

      <section className="admin-section" aria-labelledby="runs-title">
        <h2 id="runs-title">Попередні імпорти</h2>
        <StateBox state={runs} empty={runs.data?.length === 0 ? "Імпортів ще не було." : undefined}>
          {runs.data?.map((run) => <RunReport key={run.id} run={run} />)}
        </StateBox>
      </section>
    </>
  );
}

function RunReport({ run, open = false }: { run: Run; open?: boolean }) {
  return (
    <details className="admin-panel" open={open} style={{ marginTop: "var(--space-sm)" }}>
      <summary>
        <strong>{runStatus[run.status] ?? run.status}</strong>, {formatDateTime(run.startedAt)}, {run.startedBy}. {run.summary}
      </summary>
      {run.errors.length > 0 && (
        <div className="admin-table-wrap" style={{ marginTop: "var(--space-sm)" }}>
          <table className="admin-table">
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
