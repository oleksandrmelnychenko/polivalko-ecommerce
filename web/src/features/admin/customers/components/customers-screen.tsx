"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { PageHead } from "@/shared/admin/ui/page-head";
import { Pager } from "@/shared/admin/ui/pager";
import { StateBox } from "@/shared/admin/ui/state-box";
import { SearchIcon } from "@/shared/ui/icons";
import { getCustomers } from "../api/client";
import { PAGE_SIZE, sortLabel } from "../lib/customer-sort";
import { CustomersTable } from "./customers-table";

export function CustomersScreen() {
  return (
    <Suspense fallback={null}>
      <Customers />
    </Suspense>
  );
}

function Customers() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const sort = params.get("sort") ?? "";
  const page = Math.max(Number(params.get("page")) || 1, 1);
  const [text, setText] = useState(q);

  const customers = useAdminData(`${q}|${sort}|${page}`, () => getCustomers({ q: q || undefined, sort: sort || undefined, page, pageSize: PAGE_SIZE }));

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
            <CustomersTable customers={customers.data.items} />
            <Pager page={page} totalPages={customers.data.totalPages} totalItems={customers.data.totalItems} pageSize={PAGE_SIZE} onPage={(n) => go({ page: String(n) })} />
          </>
        )}
      </StateBox>
    </>
  );
}
