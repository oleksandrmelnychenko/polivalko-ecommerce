import type { ReactNode } from "react";

export function PageHead({ title, sub, children }: { title: ReactNode; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="console-head">
      <div className="console-head__text">
        <h1 className="console-title">{title}</h1>
        {sub && <p className="console-head__sub">{sub}</p>}
      </div>
      {children && <div className="console-head__actions">{children}</div>}
    </div>
  );
}
