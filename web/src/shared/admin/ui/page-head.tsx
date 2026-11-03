import type { ReactNode } from "react";

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="admin-head">
      <div className="admin-head__text">
        <h1 className="admin-title">{title}</h1>
        {sub && <p className="admin-head__sub">{sub}</p>}
      </div>
      {children && <div className="admin-head__actions">{children}</div>}
    </div>
  );
}
