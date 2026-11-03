import type { components } from "@/shared/api/schema";
import { formatDateTime } from "@/shared/lib/format";
import { serviceRequestStatusLabel } from "@/shared/lib/labels";
import { PhoneIcon } from "@/shared/ui/icons";
import type { RequestStatus } from "../lib/types";

type ServiceRequest = components["schemas"]["AdminServiceRequestDto"];

export function RequestsTable({ requests, onStatus }: { requests: ServiceRequest[]; onStatus: (id: string, status: RequestStatus) => void }) {
  return (
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
          {requests.map((r) => (
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
                <select id={`st-${r.id}`} className="select" style={{ width: "11rem" }} value={r.status} onChange={(e) => onStatus(r.id, e.target.value as RequestStatus)}>
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
  );
}
