"use client";

import { browserApi } from "@/lib/api/browser";
import { useAdminData } from "@/lib/admin";
import { StateBox } from "../ui";
import { when } from "../content/_lib";
import { ErrorText, Failures } from "./_lib";

const modeLabel: Record<string, string> = {
  demo: "демо: ключ API не налаштовано, вітрина показує демонстраційні відділення",
  api: "API Нової пошти: вітрина бачить локальну копію довідника",
};

const count = (n: number) => n.toLocaleString("uk-UA");

/** Довідник Нової пошти: режим, обсяг локальної копії й стан синхронізації (лише адміністратор). */
export function NovaPoshtaSection() {
  const np = useAdminData("novaposhta", () => browserApi.GET("/api/v1/admin/delivery/novaposhta"));
  const d = np.data;

  return (
    <section className="admin-section" aria-labelledby="np-title">
      <div className="admin-section__head">
        <h2 id="np-title">Нова пошта</h2>
      </div>
      <StateBox state={np} skeletonHeight="var(--space-3xl)">
        {d && (
          <dl className="buybox__meta admin-meta">
            <dt>Режим</dt>
            <dd>{modeLabel[d.mode] ?? d.mode}</dd>
            <dt>Населених пунктів</dt>
            <dd className="num">{count(d.settlements)}</dd>
            <dt>Відділень і поштоматів</dt>
            <dd className="num">
              {count(d.warehouses)}, з них поштоматів {count(d.postomats)}
            </dd>
            <dt>Остання спроба</dt>
            <dd>{when(d.sync.lastAttemptAt)}</dd>
            <dt>Останній успіх</dt>
            <dd>{when(d.sync.lastSuccessAt)}</dd>
            <dt>Збоїв поспіль</dt>
            <dd className="num">
              <Failures count={d.sync.consecutiveFailures} />
            </dd>
            <dt>Остання помилка</dt>
            <dd>
              <ErrorText text={d.sync.lastError} />
            </dd>
          </dl>
        )}
      </StateBox>
    </section>
  );
}
