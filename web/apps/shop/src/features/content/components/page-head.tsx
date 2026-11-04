import Link from "next/link";

export function PageHead({ title, lead }: { title: string; lead?: string | null }) {
  return (
    <header className="page-head">
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
