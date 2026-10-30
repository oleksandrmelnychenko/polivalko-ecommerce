"use client";

import Link from "next/link";
import { browserApi } from "@/lib/api/browser";
import { useAdminData } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import { StateBox } from "../ui";

export default function AdminContentPagesPage() {
  const pages = useAdminData("pages", () => browserApi.GET("/api/v1/admin/content/pages"));

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
