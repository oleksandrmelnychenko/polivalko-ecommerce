"use client";

import Link from "next/link";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { formatDateTime } from "@/shared/lib/format";
import { getPages } from "../api/client";

export function ContentPagesScreen() {
  const pages = useAdminData("pages", () => getPages());

  return (
    <>
      <h1 className="admin-title">Текстові сторінки</h1>
      <StateBox state={pages} empty={pages.data?.length === 0 ? "Текстових сторінок ще немає." : undefined}>
        {pages.data && (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Сторінка</th>
                  <th scope="col">Адреса на сайті</th>
                  <th scope="col">Оновлено</th>
                </tr>
              </thead>
              <tbody>
                {pages.data.map((p) => (
                  <tr key={p.slug}>
                    <td>
                      <Link href={`/admin/content/pages/${p.slug}`} className="link">
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <a href={`/${p.slug}`} className="code" target="_blank" rel="noopener">
                        /{p.slug}
                      </a>
                    </td>
                    <td>
                      {formatDateTime(p.updatedAt)}
                      {p.updatedBy && (
                        <>
                          <br />
                          <span className="muted">{p.updatedBy}</span>
                        </>
                      )}
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
