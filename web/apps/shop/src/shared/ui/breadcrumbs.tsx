import Link from "next/link";

export type Breadcrumb = { name: string; path: string };

export function Breadcrumbs({ current, parents = [] }: { current?: string; parents?: Breadcrumb[] }) {
  const links = current ? [{ name: "Головна", path: "/" }, ...parents] : [];
  return (
    <nav className="crumbs" aria-label="Хлібні крихти">
      <ol>
        {links.map(({ name, path }) => <li key={path}><Link href={path}>{name}</Link></li>)}
        <li aria-current="page">{current ?? "Головна"}</li>
      </ol>
    </nav>
  );
}
