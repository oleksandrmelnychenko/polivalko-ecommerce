"use client";

import { useState } from "react";
import { useConsoleData } from "@/shared/use-console-data";
import { StateBox } from "@/shared/ui/state-box";
import { getCollections } from "../api/client";
import type { ConsoleCollection } from "../lib/types";
import { CatalogTabs } from "./catalog-tabs";
import { CollectionsForm } from "./collections-form";

export function CollectionsScreen() {
  const collections = useConsoleData("collections", () => getCollections());
  const [editing, setEditing] = useState<ConsoleCollection | "new" | null>(null);

  return (
    <>
      <h1 className="console-title">Каталог</h1>
      <CatalogTabs />
      <StateBox state={collections}>
        <div className="console-columns">
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
            <div className="console-actions">
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
