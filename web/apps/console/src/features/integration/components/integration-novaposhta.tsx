"use client";

import { when } from "@/shared/format";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getNovaPoshta } from "../api/client";
import { novaPoshtaModeLabel } from "../lib/labels";
import { ErrorText, Failures } from "./error-text";

const count = (n: number) => n.toLocaleString("uk-UA");

export function IntegrationNovaPoshta() {
  const np = useConsoleData("novaposhta", () => getNovaPoshta());
  const d = np.data;

  return (
    <section className="console-section" aria-labelledby="np-title">
      <div className="console-section__head">
        <h2 id="np-title">Нова пошта</h2>
      </div>
      <StateBox state={np} skeletonHeight="var(--space-3xl)">
        {d && (
          <dl className="buybox__meta console-meta">
            <dt>Режим</dt>
            <dd>{novaPoshtaModeLabel[d.mode] ?? d.mode}</dd>
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
