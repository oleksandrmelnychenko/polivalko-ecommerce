import Link from "next/link";
import { breadcrumbJsonLd, JsonLd } from "@/features/seo";

export function PageHead({ title, lead, path }: { title: string; lead?: string | null; path?: string }) {
  return (
    <header className="page-head">
      <JsonLd data={breadcrumbJsonLd([{ name: title, path }])} />
      <nav className="crumbs" aria-label="Хлібні крихти">
        <ol>
          <li>
            <Link href="/">Головна</Link>
          </li>
          <li aria-current="page">{title}</li>
        </ol>
      </nav>
      <h1>{title}</h1>
      {lead && <p className="lead">{lead}</p>}
    </header>
  );
}
