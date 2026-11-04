"use client";

import { useState } from "react";

export function useSelection() {
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  return {
    selected,
    has: (key: string) => selected.has(key),
    toggle: (key: string) =>
      setSelected((s) => {
        const next = new Set(s);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      }),
    setAll: (keys: string[], on: boolean) =>
      setSelected((s) => {
        const next = new Set(s);
        keys.forEach((k) => (on ? next.add(k) : next.delete(k)));
        return next;
      }),
    clear: () => setSelected(new Set()),
  };
}
export type Selection = ReturnType<typeof useSelection>;

export function CheckAll({ keys, selection, label }: { keys: string[]; selection: Selection; label: string }) {
  const count = keys.filter((k) => selection.has(k)).length;
  return (
    <input
      type="checkbox"
      aria-label={label}
      checked={keys.length > 0 && count === keys.length}
      ref={(el) => {
        if (el) el.indeterminate = count > 0 && count < keys.length;
      }}
      onChange={(e) => selection.setAll(keys, e.target.checked)}
    />
  );
}
