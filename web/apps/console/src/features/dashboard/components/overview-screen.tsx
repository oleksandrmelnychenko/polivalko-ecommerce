"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { OrdersTable } from "@/features/orders";
import { useSummary } from "@/features/shell";
import { useConsoleData } from "@/shared/use-console-data";
import { PageHead } from "@/shared/ui/page-head";
import { StateBox } from "@/shared/ui/state-box";
import { getDashboard, getLatestOrders } from "../api/client";
import type { Metric } from "../lib/types";
import { HealthAlerts } from "./health-alerts";
import { Insights } from "./insights";
import { WorkQueue } from "./work-queue";

const PERIODS = [7, 30, 90] as const;

export function OverviewScreen() {
  return (
    <Suspense fallback={null}>
      <Overview />
    </Suspense>
  );
}

function Overview() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const days = PERIODS.find((p) => String(p) === params.get("days")) ?? 30;
  const [metric, setMetric] = useState<Metric>("revenue");
  const dashboard = useConsoleData(`dashboard|${days}`, () => getDashboard(days));
  const latest = useConsoleData("latest", () => getLatestOrders());
  const { summary } = useSummary();

  return (
    <>
      <PageHead title="Огляд" sub={`Останні ${days} днів порівняно з попередніми ${days}. Час — київський.`}>
        <div className="seg" role="group" aria-label="Період">
          {PERIODS.map((p) => (
            <button key={p} type="button" aria-pressed={p === days} onClick={() => router.replace(p === 30 ? pathname : `${pathname}?days=${p}`, { scroll: false })}>
              {p} днів
            </button>
          ))}
        </div>
      </PageHead>

      {summary && <HealthAlerts summary={summary} />}
      {summary && <WorkQueue summary={summary} />}

      <StateBox state={dashboard} skeletonHeight="560px">
        {dashboard.data && <Insights data={dashboard.data} metric={metric} onMetric={setMetric} />}
      </StateBox>

      <section className="console-card" style={{ marginTop: "var(--a-gap)" }} aria-labelledby="latest-title">
        <div className="console-card__head">
          <h2 id="latest-title">Останні замовлення</h2>
          <Link href="/orders" className="link">
            Усі замовлення
          </Link>
        </div>
        <StateBox state={latest} empty={latest.data?.items.length === 0 ? "Замовлень ще немає. Вони з'являться тут одразу після оформлення на сайті." : undefined}>
          {latest.data && <OrdersTable orders={latest.data.items} />}
        </StateBox>
      </section>
    </>
  );
}
