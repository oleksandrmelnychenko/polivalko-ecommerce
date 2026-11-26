import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";
import type { ReactNode } from "react";
import { CustomerPageNav } from "./customer-page-nav";
import { customerPages } from "@/shared/lib/customer-pages";
import "../styles/customer-banner.css";

export function PageHead({ title, lead, path, actions, children }: { title: string; lead?: string | null; path?: string; actions?: ReactNode; children?: ReactNode }) {
  const customerPage = customerPages.find(page => page.href === path);
  const titleLines = customerPage && title.trim().match(/^(\S+)\s+((?:(?:і|й|та)\s+)?\S+)$/u);
  const content = <>
    <h1>{titleLines ? <>{titleLines[1]}{" "}<br />{titleLines[2]}</> : title}</h1>
    {lead && <p className="lead">{lead}</p>}
    {actions}
  </>;
  return (
    <>
      <JsonLd data={breadcrumbJsonLd([{ name: title, path }])} />
      <Breadcrumbs current={title} />
      <CustomerPageNav path={path} />
      {customerPage ? (
        <div className="customer-layout">
          <header className="customer-banner garden-print" data-tone={customerPage.tone}>
            <div className="customer-banner__copy">{content}</div>
          </header>
          <div className="customer-layout__info">{children}</div>
        </div>
      ) : <><header className="page-head">{content}</header>{children}</>}
    </>
  );
}
