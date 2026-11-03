"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useSummary } from "@/features/admin/shell";
import { withCsrf } from "@/shared/admin/csrf";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { PageHead } from "@/shared/admin/ui/page-head";
import { StateBox } from "@/shared/admin/ui/state-box";
import { serviceRequestStatusLabel } from "@/shared/lib/labels";
import { changeServiceRequestStatus, getServiceRequests } from "../api/client";
import type { RequestStatus } from "../lib/types";
import { RequestsTable } from "./requests-table";

export function RequestsScreen() {
  return (
    <Suspense fallback={null}>
      <Requests />
    </Suspense>
  );
}

function Requests() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const status = (params.get("status") ?? "") as RequestStatus | "";
  const { summary, reload: reloadSummary } = useSummary();

  const requests = useAdminData(status, () => getServiceRequests({ status: status || undefined, page: 1, pageSize: 50 }));

  async function change(id: string, next: RequestStatus) {
    const { response } = await withCsrf((headers) => changeServiceRequestStatus(headers, id, { status: next }));
    if (response.ok) {
      requests.reload();
      reloadSummary();
    }
  }

  return (
    <>
      <PageHead title="Заявки на послуги" sub="Заявки з форми на сторінці послуг: передзвоніть клієнту й відмітьте статус." />
      <nav className="admin-tabs" aria-label="Статус заявки">
        <button type="button" aria-pressed={!status} onClick={() => router.replace(pathname, { scroll: false })}>
          Усі
        </button>
        {Object.entries(serviceRequestStatusLabel).map(([v, l]) => (
          <button key={v} type="button" aria-pressed={status === v} onClick={() => router.replace(`${pathname}?status=${v}`, { scroll: false })}>
            {l}
            {v === "new" && summary && summary.newServiceRequests > 0 && <span className="tab-count tab-count--hot">{summary.newServiceRequests}</span>}
          </button>
        ))}
      </nav>
      <StateBox state={requests} empty={requests.data?.items.length === 0 ? "Заявок немає. Вони приходять з форми на сторінці послуг." : undefined}>
        {requests.data && <RequestsTable requests={requests.data.items} onStatus={change} />}
      </StateBox>
    </>
  );
}
