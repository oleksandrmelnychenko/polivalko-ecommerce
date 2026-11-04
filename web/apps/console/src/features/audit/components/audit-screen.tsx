"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AdminOnly } from "@/features/auth";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getAudit } from "../api/client";
import { AuditFilters } from "./audit-filters";
import { AuditTable } from "./audit-table";

const PAGE_SIZE = 30;

export function AuditScreen() {
  return (
    <AdminOnly title="Журнал змін">
      <Suspense fallback={null}>
        <Audit />
      </Suspense>
    </AdminOnly>
  );
}

function Audit() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const entityType = params.get("entityType") ?? "";
  const q = params.get("q") ?? "";
  const page = Math.max(Number(params.get("page")) || 1, 1);

  const audit = useConsoleData(`${entityType}|${q}|${page}`, () => getAudit({ entityType: entityType || undefined, q: q || undefined, page, pageSize: PAGE_SIZE }));

  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`);
  };

  const data = audit.data;

  return (
    <>
      <h1 className="console-title">Журнал змін</h1>
      <AuditFilters entityType={entityType} q={q} go={go} />

      <StateBox state={audit} empty={data?.items.length === 0 ? (q || entityType ? "За цими умовами записів немає." : "Журнал порожній.") : undefined}>
        {data && (
          <>
            <p className="muted console-count">Записів: {data.totalItems}</p>
            <AuditTable items={data.items} />
            {data.totalPages > 1 && (
              <nav className="pager console-pager" aria-label="Сторінки журналу">
                <button type="button" className="pager__btn" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>
                  Новіші
                </button>
                <span aria-current="page">
                  {page} з {data.totalPages}
                </span>
                <button type="button" className="pager__btn" disabled={page >= data.totalPages} onClick={() => go({ page: String(page + 1) })}>
                  Старіші
                </button>
              </nav>
            )}
          </>
        )}
      </StateBox>
    </>
  );
}
