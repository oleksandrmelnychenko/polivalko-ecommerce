import Link from "next/link";
import type { components } from "@polivalko/shared/api/schema";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { actionLabel, entityHref, entityTypeLabel } from "../lib/audit-labels";

type Entry = components["schemas"]["AuditEntryDto"];

export function AuditTable({ items }: { items: Entry[] }) {
  return (
    <div className="console-table-wrap">
      <table className="console-table">
        <thead>
          <tr>
            <th scope="col">Коли</th>
            <th scope="col">Хто</th>
            <th scope="col">Дія</th>
            <th scope="col">Об&apos;єкт</th>
            <th scope="col">Деталі</th>
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const href = a.entityId ? entityHref[a.entityType]?.(a.entityId) : undefined;
            return (
              <tr key={a.id}>
                <td className="console-nowrap">{formatDateTime(a.at)}</td>
                <td>{a.actor}</td>
                <td>
                  {actionLabel[a.action] ?? a.action}
                  {actionLabel[a.action] && (
                    <>
                      <br />
                      <span className="muted console-small">{a.action}</span>
                    </>
                  )}
                </td>
                <td>
                  {entityTypeLabel[a.entityType] ?? a.entityType}
                  {a.entityId && (
                    <>
                      <br />
                      {href ? (
                        <Link href={href} className="code">
                          {a.entityId}
                        </Link>
                      ) : (
                        <span className="code">{a.entityId}</span>
                      )}
                    </>
                  )}
                </td>
                <td>
                  {a.details == null ? (
                    <span className="muted">немає</span>
                  ) : (
                    <details className="console-details">
                      <summary>JSON</summary>
                      <pre className="console-pre">{JSON.stringify(a.details, null, 2)}</pre>
                    </details>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
