import { Breadcrumbs } from "@/shared/ui/breadcrumbs";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";

export function PageHead({ title, lead, path }: { title: string; lead?: string | null; path?: string }) {
  return (
    <>
      <Breadcrumbs current={title} />
      <header className="page-head">
        <JsonLd data={breadcrumbJsonLd([{ name: title, path }])} />
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </header>
    </>
  );
}
