import type { ReactNode } from "react";

export function FooterColumn({ id, title, as = "nav", children }: { id: string; title: string; as?: "nav" | "div"; children: ReactNode }) {
  const Tag = as;
  return (
    <Tag className="footer__col" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {children}
    </Tag>
  );
}
