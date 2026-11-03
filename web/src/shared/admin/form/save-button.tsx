import type { ReactNode } from "react";

export function SaveButton({ busy, disabled, children = "Зберегти" }: { busy: boolean; disabled?: boolean; children?: ReactNode }) {
  return (
    <button type="submit" className="btn btn--small" disabled={busy || disabled} aria-busy={busy}>
      {busy ? "Зберігаємо…" : children}
    </button>
  );
}
