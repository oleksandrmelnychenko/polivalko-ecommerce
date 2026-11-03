"use client";

import { useState } from "react";
import { useAdminData } from "@/shared/admin/use-admin-data";
import { StateBox } from "@/shared/admin/ui/state-box";
import { getCollections } from "../api/client";
import type { AdminCollection } from "../lib/types";
import { CatalogTabs } from "./catalog-tabs";
import { CollectionsForm } from "./collections-form";

export function CollectionsScreen() {
  const collections = useAdminData("collections", () => getCollections());
  const [editing, setEditing] = useState<AdminCollection | "new" | null>(null);

  return (
    <>
      <h1 className="admin-title">Каталог</h1>
      <CatalogTabs />
      <StateBox state={collections}>
        <div className="admin-columns">
          <div>
            {(collections.data ?? []).length === 0 && <p className="muted">Добірок ще немає. Головна покаже лише розділи й знижки.</p>}
            <ul className="pick-list" style={{ maxHeight: "none" }}>
              {(collections.data ?? []).map((c) => (
                <li key={c.id}>
                  <span>
                    <strong>{c.title}</strong> <span className="code muted">{c.code}</span>
                    <br />
                    <span className="muted">
                      {c.products.length} товарів{c.isVisible ? "" : ", прихована"}
                    </span>
                  </span>
                  <button type="button" className="btn btn--small btn--quiet" onClick={() => setEditing(c)}>
                    Змінити
                  </button>
                </li>
              ))}
            </ul>
            <div className="admin-actions">
              <button type="button" className="btn btn--small" onClick={() => setEditing("new")}>
                Нова добірка
              </button>
            </div>
          </div>
          {editing && (
            <CollectionsForm
              key={editing === "new" ? "new" : editing.id}
              collection={editing === "new" ? null : editing}
              onDone={() => {
                setEditing(null);
                collections.reload();
              }}
            />
          )}
        </div>
      </StateBox>
    </>
  );
}
