"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { SearchIcon } from "@/components/icons";
import { browserApi } from "@/lib/api/browser";
import { useAdminData } from "@/lib/admin";
import { formatDateTime, formatMoney, plural } from "@/lib/format";
import { PageHead, Pager, StateBox } from "../ui";

const PAGE_SIZE = 25;
const sortLabel = { lastOrder: "Останнє замовлення", totalSpent: "Сума покупок", orders: "Кількість замовлень" } as const;

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={null}>
      <Customers />
    </Suspense>
  );
}

/** Покупці зібрані із замовлень за телефоном: скільки замовляли, на яку суму, коли востаннє. */
function Customers() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const [text, setText] = useState(q);

  const customers = useAdminData(`${q}|${sort}|${page}`, () =>
    browserApi.GET("/api/v1/admin/customers", { params: { query: { q: q || undefined, sort: sort || undefined, page, pageSize: PAGE_SIZE } } }),
  );

  const go = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    if (!("page" in patch)) next.delete("page");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  return (
    <>
      <PageHead title="Покупці" sub="Покупця визначає номер телефону: усі замовлення з ним — одна людина." />
      <form
        className="admin-filters"
        role="search"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          go({ q: text.trim() });
        }}
      >
        <div className="field field--wide">
          <label htmlFor="q">Пошук</label>
          <span className="input-icon">
            <SearchIcon />
            <input id="q" type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Ім'я, телефон або email…" autoComplete="off" spellCheck={false} />
          </span>
        </div>
        <div className="field">
          <label htmlFor="sort">Порядок</label>
          <select id="sort" value={sort || "lastOrder"} onChange={(e) => go({ sort: e.target.value === "lastOrder" ? "" : e.target.value })}>
            {Object.entries(sortLabel).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="admin-filters__actions">
          <button type="submit" className="btn">
            Знайти
          </button>
          {q && (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => {
                setText("");
                go({ q: "" });
              }}
            >
              Скинути
            </button>
          )}
        </div>
      </form>

      <StateBox state={customers} empty={customers.data?.items.length === 0 ? (q ? "За цим запитом покупців немає." : "Покупців ще немає.") : undefined}>
        {customers.data && (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th scope="col">Покупець</th>
                    <th scope="col">Телефон</th>
                    <th scope="col" className="num">
                      Замовлень
                    </th>
                    <th scope="col" className="num">
                      Сума покупок
                    </th>
                    <th scope="col">Перше</th>
                    <th scope="col">Останнє</th>
                    <th scope="col" className="col-actions">
                      <span className="visually-hidden">Дії</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {customers.data.items.map((c) => (
                    <tr key={c.phone}>
                      <td>
                        <span className="cell-main">
                          <span className="admin-avatar" aria-hidden="true" style={{ background: "#efefef" }}>
                            {initials(c.name)}
                          </span>
                          <span>
                            <span className="cell-strong">{c.name}</span>
                            <span className="cell-sub">{c.email ?? "без email"}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <a className="link" href={`tel:${c.phone}`}>
                          {c.phone}
                        </a>
                      </td>
                      <td className="num">
                        {c.orders > 1 ? <span className="chip chip--green">{c.orders} · постійний</span> : c.orders}
                      </td>
                      <td className="num cell-strong">{formatMoney(c.totalSpent)}</td>
                      <td>{formatDateTime(c.firstOrderAt)}</td>
                      <td>
                        <Link href={`/admin/orders/${c.lastOrderNumber}`} className="code">
                          {c.lastOrderNumber}
                        </Link>
                        <span className="cell-sub">{formatDateTime(c.lastOrderAt)}</span>
                      </td>
                      <td className="col-actions">
                        <Link href={`/admin/orders?q=${encodeURIComponent(c.phone)}`} className="btn btn--small btn--quiet">
                          {c.orders} {plural(c.orders, "замовлення", "замовлення", "замовлень")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager page={page} totalPages={customers.data.totalPages} totalItems={customers.data.totalItems} pageSize={PAGE_SIZE} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </StateBox>
    </>
  );
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter((w) => /^\p{L}/u.test(w))
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("") || "?"
  );
}
