"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import type { Problem } from "@/shared/api/problem";
import { getImportRuns, importCatalog } from "../api/client";
import type { ImportRun } from "../lib/types";
import { AdminOnlyNotice } from "./admin-only-notice";
import { CatalogTabs } from "./catalog-tabs";
import { ImportRunReport } from "./import-run-report";

export function ImportScreen() {
  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <AdminOnlyNotice>
        <Import />
      </AdminOnlyNotice>
    </>
  );
}

function Import() {
  const runs = useAdminData("import-runs", () => getImportRuns());
  const [result, setResult] = useState<ImportRun | null>(null);
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
    const response = await importCatalog(data);
    setBusy(false);
    if (response.ok) {
      setResult((await response.json()) as ImportRun);
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

      {result && <ImportRunReport run={result} open />}

      <section className="admin-section" aria-labelledby="runs-title">
        <h2 id="runs-title">Попередні імпорти</h2>
        <StateBox state={runs} empty={runs.data?.length === 0 ? "Імпортів ще не було." : undefined}>
          {runs.data?.map((run) => <ImportRunReport key={run.id} run={run} />)}
        </StateBox>
      </section>
    </>
  );
}
