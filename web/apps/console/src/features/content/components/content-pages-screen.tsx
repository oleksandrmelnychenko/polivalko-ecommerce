"use client";

import Link from "next/link";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { siteUrl } from "@/shared/site-url";
import { formatDateTime } from "@polivalko/shared/lib/format";
import { getPages } from "../api/client";

export function ContentPagesScreen() {
  const pages = useConsoleData("pages", () => getPages());

  return (
    <>
      <h1 className="console-title">Текстові сторінки</h1>
      <StateBox state={pages} empty={pages.data?.length === 0 ? "Текстових сторінок ще немає." : undefined}>
        {pages.data && (
          <div className="console-table-wrap">
            <table className="console-table">
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
                      <Link href={`/content/pages/${p.slug}`} className="link">
                        {p.title}
                      </Link>
                    </td>
                    <td>
                      <a href={siteUrl(`/${p.slug}`)} className="code" target="_blank" rel="noopener">
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
