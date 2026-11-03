"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useStaff } from "@/features/admin/auth";
import { withCsrf } from "@/shared/admin/csrf";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { problemOf, problemText } from "@/shared/api/problem";
import { getIntegrationStatus, runJob } from "../api/client";
import { navkoloModeLabel } from "../lib/labels";
import { IntegrationJobs, type RunRequest } from "./integration-jobs";
import { IntegrationNovaPoshta } from "./integration-novaposhta";
import { IntegrationOutbox } from "./integration-outbox";
import { IntegrationRuns } from "./integration-runs";

export function IntegrationScreen() {
  return (
    <Suspense fallback={null}>
      <Integration />
    </Suspense>
  );
}

function Integration() {
  const { isAdmin } = useStaff();
  const status = useAdminData("integration", () => getIntegrationStatus());
  const [requests, setRequests] = useState<Record<string, RunRequest>>({});

  async function run(job: string) {
    setRequests((r) => ({ ...r, [job]: { busy: true } }));
    let next: RunRequest;
    try {
      const result = await withCsrf((headers) => runJob(headers, job));
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

            <IntegrationJobs jobs={s.jobs} requests={requests} canRun={isAdmin} onRun={run} onRefresh={refresh} />
          </>
        )}
      </StateBox>

      <IntegrationRuns jobs={s?.jobs ?? []} />
      {isAdmin && <IntegrationOutbox onRetried={status.reload} />}
      {isAdmin && <IntegrationNovaPoshta />}
    </>
  );
}
