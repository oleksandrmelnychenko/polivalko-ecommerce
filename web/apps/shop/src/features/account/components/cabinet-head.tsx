import type { ReactNode } from "react";

export function CabinetHead({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="cabinet__head">
      <h2 id="cabinet-title">{title}</h2>
      {children}
    </div>
  );
}
