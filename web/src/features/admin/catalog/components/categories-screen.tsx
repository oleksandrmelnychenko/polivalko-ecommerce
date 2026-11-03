"use client";

import { useState } from "react";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { getCategories } from "../api/client";
import { depthOf, descendants, type AdminCategory } from "../lib/category-tree";
import { AdminOnlyNotice } from "./admin-only-notice";
import { CatalogTabs } from "./catalog-tabs";
import { CategoriesForm } from "./categories-form";

export function CategoriesScreen() {
  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <AdminOnlyNotice>
        <Categories />
      </AdminOnlyNotice>
    </>
  );
}

function Categories() {
  const categories = useAdminData("admin-categories", () => getCategories());
  const [editing, setEditing] = useState<AdminCategory | "new" | null>(null);

  const list = categories.data ?? [];
  const top = list.filter((c) => !c.parentId);
  const ordered = top.flatMap((t) => [t, ...descendants(list, t.id, 1).map((c) => c)]);

  return (
    <StateBox state={categories}>
      <div className="admin-columns">
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col">Розділ</th>
                <th scope="col">Група Navkolo</th>
                <th scope="col">Фільтри</th>
                <th scope="col" className="num">
                  Товарів
                </th>
                <th scope="col">
                  <span className="visually-hidden">Дія</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ordered.map((c) => (
                <tr key={c.id}>
                  <td style={{ paddingLeft: `calc(var(--space-sm) + ${depthOf(list, c) * 1.25}rem)` }}>
                    {c.name}
                    {!c.isVisible && <span className="muted"> (прихований)</span>}
                    <br />
                    <span className="code muted">/catalog/{c.slug}</span>
                  </td>
                  <td>{c.navkoloRef ?? <span className="muted">не задано</span>}</td>
                  <td>{c.filterAttributes.length ? c.filterAttributes.join(", ") : <span className="muted">успадковані</span>}</td>
                  <td className="num">{c.productCount}</td>
                  <td>
                    <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(c)}>
                      Змінити
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin-actions">
            <button type="button" className="btn btn--small" onClick={() => setEditing("new")}>
              Новий підрозділ
            </button>
          </div>
        </div>
        {editing && (
          <CategoriesForm
            key={editing === "new" ? "new" : editing.id}
            category={editing === "new" ? null : editing}
            all={list}
            onDone={() => {
              setEditing(null);
              categories.reload();
            }}
          />
        )}
      </div>
    </StateBox>
  );
}
