"use client";

import { useState, type FormEvent } from "react";
import { entityTypeLabel } from "../lib/audit-labels";

export function AuditFilters({ entityType, q, go }: { entityType: string; q: string; go: (patch: Record<string, string>) => void }) {
  const [text, setText] = useState(q);
  return (
    <form
      className="console-filters"
      role="search"
      onSubmit={(e: FormEvent) => {
        e.preventDefault();
        go({ q: text.trim() });
      }}
    >
      <div className="field">
        <label htmlFor="entityType">Об&apos;єкт</label>
        <select id="entityType" value={entityType} onChange={(e) => go({ entityType: e.target.value })}>
          <option value="">Усі</option>
          {Object.entries(entityTypeLabel).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="q">Пошук</label>
        <input id="q" value={text} onChange={(e) => setText(e.target.value)} placeholder="PV-100001, ім'я або user.locked" aria-describedby="q-help" />
      </div>
      <button type="submit" className="btn btn--small btn--quiet">
        Знайти
      </button>
      <p id="q-help" className="field__help console-filters__note">
        Пошук: точний номер чи код об&apos;єкта, ім&apos;я працівника або частина коду дії.
      </p>
    </form>
  );
}
