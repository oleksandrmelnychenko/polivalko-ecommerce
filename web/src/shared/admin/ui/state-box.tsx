"use client";

import type { ReactNode } from "react";

export function StateBox({
  state,
  empty,
  skeletonHeight = "var(--space-4xl)",
  children,
}: {
  state: { status: "loading" | "error" | "ready"; reload: () => void; pending?: boolean };
  empty?: string;
  skeletonHeight?: string;
  children: ReactNode;
}) {
  if (state.status === "loading") return <div className="skeleton" style={{ height: skeletonHeight }} aria-busy="true" />;
  if (state.status === "error")
    return (
      <div className="notice notice--error" role="alert">
        <strong>Не вдалося завантажити дані</strong>
        Перевірте, що API працює, і спробуйте ще раз.{" "}
        <button type="button" className="remove" onClick={state.reload}>
          Повторити
        </button>
      </div>
    );
  if (empty) return <div className="empty"><p>{empty}</p></div>;
  return state.pending ? (
    <div className="is-stale" aria-busy="true">
      {children}
    </div>
  ) : (
    <>{children}</>
  );
}
