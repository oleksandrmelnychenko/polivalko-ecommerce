"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PhoneIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import type { components } from "@/lib/api/schema";
import { useAdminData } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { serviceRequestStatusLabel } from "@/lib/labels";
import { useSummary } from "../admin-shell";
import { mutate } from "../catalog/_shared";
import { PageHead, StateBox } from "../ui";

type Status = components["schemas"]["ServiceRequestStatus"];

export default function AdminRequestsPage() {
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
  const status = (params.get("status") ?? "") as Status | "";
  const { summary, reload: reloadSummary } = useSummary();

  const requests = useAdminData(status, () =>
    browserApi.GET("/api/v1/admin/service-requests", { params: { query: { status: status || undefined, page: 1, pageSize: 50 } } }),
  );

  async function change(id: string, next: Status) {
    const { response } = await mutate((headers) => browserApi.POST("/api/v1/admin/service-requests/{id}/status", { params: { path: { id } }, headers, body: { status: next } }));
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
        {requests.data && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Клієнт</th>
                  <th scope="col">Напрямок</th>
                  <th scope="col">Коментар</th>
                  <th scope="col">Отримано</th>
                  <th scope="col">Статус</th>
                </tr>
              </thead>
              <tbody>
                {requests.data.items.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="cell-strong">{r.name}</span>
                      <a className="cell-sub" href={`tel:${r.phone}`} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <PhoneIcon className="admin-icon-xs" />
                        {r.phone}
                      </a>
                    </td>
                    <td>
                      <span className="chip chip--outline">{r.directionName}</span>
                    </td>
                    <td style={{ maxWidth: "28rem" }}>{r.comment ?? <span className="muted">без коментаря</span>}</td>
                    <td className="admin-nowrap">{formatDateTime(r.createdAt)}</td>
                    <td>
                      <label className="visually-hidden" htmlFor={`st-${r.id}`}>
                        Статус заявки
                      </label>
                      <select id={`st-${r.id}`} className="select" style={{ width: "11rem" }} value={r.status} onChange={(e) => change(r.id, e.target.value as Status)}>
                        {Object.entries(serviceRequestStatusLabel).map(([v, l]) => (
                          <option key={v} value={v}>
                            {l}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </StateBox>
    </>
  );
}
